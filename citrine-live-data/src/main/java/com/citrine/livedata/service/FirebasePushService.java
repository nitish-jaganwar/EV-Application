package com.citrine.livedata.service;

import com.citrine.livedata.model.AppNotification;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;

public class FirebasePushService {
    private final boolean enabled;

    public FirebasePushService(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public SendResult send(String token, AppNotification notification) {
        if (!enabled) return new SendResult(false, false, "Firebase is disabled");

        Message message = Message.builder()
                .setToken(token)
                .setNotification(Notification.builder()
                        .setTitle(notification.getTitle())
                        .setBody(notification.getBody())
                        .build())
                .putAllData(notification.toFcmData())
                .setAndroidConfig(AndroidConfig.builder()
                        .setPriority(AndroidConfig.Priority.HIGH)
                        .setNotification(AndroidNotification.builder()
                                .setChannelId("charging-updates")
                                .setSound("default")
                                .build())
                        .build())
                .build();
        try {
            return new SendResult(true, false, FirebaseMessaging.getInstance().send(message));
        } catch (FirebaseMessagingException exception) {
            String code = exception.getMessagingErrorCode() == null
                    ? "UNKNOWN" : exception.getMessagingErrorCode().name();
            boolean invalid = "UNREGISTERED".equals(code)
                    || "INVALID_ARGUMENT".equals(code);
            System.err.printf("FCM send failed code=%s message=%s%n", code, exception.getMessage());
            return new SendResult(false, invalid, code);
        }
    }

    public record SendResult(boolean success, boolean invalidToken, String detail) { }
}
