package com.citrine.livedata.service;

import com.citrine.livedata.model.PushTokenRegistration;
import com.citrine.livedata.model.PushTokenRequest;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class DeviceTokenService {
    private final Map<String, Map<String, StoredToken>> tokensByResident =
            new ConcurrentHashMap<>();

    public PushTokenRegistration register(String residentId, PushTokenRequest request) {
        if (request == null || request.getToken() == null || request.getToken().isBlank()) {
            throw new IllegalArgumentException("FCM token is required");
        }
        String token = request.getToken().trim();
        if (token.length() > 4096) {
            throw new IllegalArgumentException("FCM token is too long");
        }

        String platform = normalized(request.getPlatform(), "android");
        String provider = normalized(request.getProvider(), "fcm");
        if (!"android".equals(platform) || !"fcm".equals(provider)) {
            throw new IllegalArgumentException("This POC accepts Android FCM tokens only");
        }

        String deviceId = request.getDeviceId() == null || request.getDeviceId().isBlank()
                ? "token-" + digest(token).substring(0, 16)
                : request.getDeviceId().trim();
        if (deviceId.length() > 160) {
            throw new IllegalArgumentException("deviceId is too long");
        }

        String now = Instant.now().toString();
        Map<String, StoredToken> residentTokens = tokensByResident.computeIfAbsent(
                residentId, ignored -> new ConcurrentHashMap<>());
        StoredToken stored = residentTokens.compute(deviceId, (ignored, existing) ->
                new StoredToken(
                        existing == null ? digest(residentId + ":" + deviceId).substring(0, 24) : existing.id,
                        residentId,
                        platform,
                        provider,
                        deviceId,
                        token,
                        existing == null ? now : existing.createdAt,
                        now
                ));
        return stored.publicView();
    }

    public List<PushTokenRegistration> registrations(String residentId) {
        Map<String, StoredToken> tokens = tokensByResident.get(residentId);
        if (tokens == null) return List.of();
        return tokens.values().stream()
                .map(StoredToken::publicView)
                .sorted(Comparator.comparing(PushTokenRegistration::updatedAt).reversed())
                .toList();
    }

    public List<String> activeTokens(String residentId) {
        Map<String, StoredToken> tokens = tokensByResident.get(residentId);
        if (tokens == null) return List.of();
        List<String> result = new ArrayList<>();
        tokens.values().forEach(token -> result.add(token.token));
        return result;
    }

    public boolean remove(String residentId, String registrationId) {
        Map<String, StoredToken> tokens = tokensByResident.get(residentId);
        if (tokens == null) return false;
        String key = tokens.entrySet().stream()
                .filter(entry -> entry.getValue().id.equals(registrationId))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(null);
        return key != null && tokens.remove(key) != null;
    }

    public void removeToken(String residentId, String invalidToken) {
        Map<String, StoredToken> tokens = tokensByResident.get(residentId);
        if (tokens != null) {
            tokens.entrySet().removeIf(entry -> entry.getValue().token.equals(invalidToken));
        }
    }

    private String normalized(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim().toLowerCase();
    }

    private String digest(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte item : bytes) result.append(String.format("%02x", item));
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private record StoredToken(
            String id,
            String residentId,
            String platform,
            String provider,
            String deviceId,
            String token,
            String createdAt,
            String updatedAt
    ) {
        PushTokenRegistration publicView() {
            return new PushTokenRegistration(
                    id, residentId, platform, provider, deviceId, createdAt, updatedAt
            );
        }
    }
}
