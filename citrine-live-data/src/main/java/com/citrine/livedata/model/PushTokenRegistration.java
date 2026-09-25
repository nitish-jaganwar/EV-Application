package com.citrine.livedata.model;

public record PushTokenRegistration(
        String id,
        String residentId,
        String platform,
        String provider,
        String deviceId,
        String createdAt,
        String updatedAt
) {
}
