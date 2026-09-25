package com.citrine.livedata.service;

import com.citrine.livedata.config.FirebaseConfig;

public final class AppServices implements AutoCloseable {
    private static volatile AppServices instance;

    private final OwnershipService ownershipService;
    private final DeviceTokenService deviceTokenService;
    private final NotificationStore notificationStore;
    private final ChargingNotificationService notificationService;
    private final OcppEventService ocppEventService;

    private AppServices() {
        boolean firebaseEnabled = FirebaseConfig.initialize();
        ownershipService = new OwnershipService();
        deviceTokenService = new DeviceTokenService();
        notificationStore = new NotificationStore();
        FirebasePushService firebasePushService = new FirebasePushService(firebaseEnabled);
        notificationService = new ChargingNotificationService(
                ownershipService, deviceTokenService, notificationStore, firebasePushService);
        ocppEventService = new OcppEventService(notificationService);
    }

    public static synchronized AppServices initialize() {
        if (instance == null) instance = new AppServices();
        return instance;
    }

    public static AppServices get() {
        AppServices value = instance;
        return value == null ? initialize() : value;
    }

    public OwnershipService ownership() { return ownershipService; }
    public DeviceTokenService deviceTokens() { return deviceTokenService; }
    public NotificationStore notifications() { return notificationStore; }
    public ChargingNotificationService notificationService() { return notificationService; }
    public OcppEventService ocppEvents() { return ocppEventService; }

    @Override
    public void close() {
        notificationService.close();
    }
}
