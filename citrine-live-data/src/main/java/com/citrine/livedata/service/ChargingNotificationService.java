package com.citrine.livedata.service;

import com.citrine.livedata.model.AppNotification;
import com.citrine.livedata.model.ChargerState;
import com.citrine.livedata.model.OcppEvent;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ChargingNotificationService implements AutoCloseable {
    private final OwnershipService ownership;
    private final DeviceTokenService tokens;
    private final NotificationStore store;
    private final FirebasePushService push;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "fcm-notification-sender");
        thread.setDaemon(true);
        return thread;
    });

    public ChargingNotificationService(
            OwnershipService ownership,
            DeviceTokenService tokens,
            NotificationStore store,
            FirebasePushService push
    ) {
        this.ownership = ownership;
        this.tokens = tokens;
        this.store = store;
        this.push = push;
    }

    public void onStateChanged(ChargerState previous, ChargerState current, OcppEvent event) {
        String residentId = ownership.ownerForCharger(current.getChargerId());
        if (residentId == null) return;

        AppNotification notification = transition(previous, current, event, residentId);
        if (notification != null) publish(notification);
    }

    public AppNotification sendTest(String residentId) {
        AppNotification notification = new AppNotification(
                "test:" + Instant.now().toEpochMilli(), residentId, "test",
                "tBits Plug test notification",
                "Firebase push is connected to this device.",
                Instant.now().toString(), "notifications", null, true);
        publish(notification);
        return notification;
    }

    private AppNotification transition(
            ChargerState previous,
            ChargerState current,
            OcppEvent event,
            String residentId
    ) {
        if (previous.isOnline() && !current.isOnline()) {
            return create("charger_offline", "Charger offline",
                    current.getChargerId() + " disconnected.", current, event, residentId);
        }

        String error = current.getChargerErrorCode();
        if (error != null && !"NoError".equalsIgnoreCase(error)
                && !Objects.equals(error, previous.getChargerErrorCode())) {
            return create("charger_fault", "Charger needs attention",
                    current.getChargerId() + " reported " + error + ".",
                    current, event, residentId);
        }

        if ("Ended".equalsIgnoreCase(current.getTransactionEventType())
                && !"Ended".equalsIgnoreCase(previous.getTransactionEventType())) {
            String body = delivered(current) == null
                    ? "Your charging session has ended."
                    : String.format(Locale.ROOT,
                    "Charging ended. %.3f kWh was delivered.", delivered(current));
            return create("charging_ended", "Charging ended", body,
                    current, event, residentId);
        }

        if ("Charging".equalsIgnoreCase(current.getChargingState())
                && !"Charging".equalsIgnoreCase(previous.getChargingState())) {
            boolean resumed = isSuspended(previous.getChargingState())
                    && Objects.equals(previous.getTransactionId(), current.getTransactionId());
            return create(resumed ? "charging_resumed" : "charging_started",
                    resumed ? "Charging resumed" : "Charging started",
                    current.getChargerId() + " is delivering power.",
                    current, event, residentId);
        }

        if ("Charging".equalsIgnoreCase(previous.getChargingState())
                && isSuspended(current.getChargingState())) {
            return create("charging_paused", "Charging paused",
                    "Power delivery is paused for " + current.getChargerId() + ".",
                    current, event, residentId);
        }
        return null;
    }

    private AppNotification create(
            String type,
            String title,
            String body,
            ChargerState state,
            OcppEvent event,
            String residentId
    ) {
        String key = event.correlationId();
        if (key == null || key.isBlank()) {
            key = state.getTransactionId() + ":" + state.getLastTransactionSeqNo()
                    + ":" + state.getUpdatedAt();
        }
        if (key.length() > 120) key = key.substring(0, 120);
        return new AppNotification(type + ":" + key, residentId, type, title, body,
                Instant.now().toString(), "live", state.getTransactionId(), false);
    }

    private void publish(AppNotification notification) {
        if (!store.add(notification)) return;
        List<String> targets = tokens.activeTokens(notification.getRecipientId());
        if (targets.isEmpty()) {
            notification.setPushStatus("NO_DEVICE");
            return;
        }
        if (!push.isEnabled()) {
            notification.setPushStatus("FIREBASE_DISABLED");
            return;
        }
        notification.setPushStatus("SENDING");
        executor.submit(() -> {
            boolean anySent = false;
            for (String token : targets) {
                FirebasePushService.SendResult result = push.send(token, notification);
                anySent |= result.success();
                if (result.invalidToken()) {
                    tokens.removeToken(notification.getRecipientId(), token);
                }
            }
            notification.setPushStatus(anySent ? "SENT" : "FAILED");
        });
    }

    private boolean isSuspended(String state) {
        return "SuspendedEV".equalsIgnoreCase(state)
                || "SuspendedEVSE".equalsIgnoreCase(state);
    }

    private Double delivered(ChargerState state) {
        return state.getEnergyDeliveredWh() == null
                ? null : state.getEnergyDeliveredWh() / 1000.0;
    }

    @Override
    public void close() {
        executor.shutdown();
    }
}
