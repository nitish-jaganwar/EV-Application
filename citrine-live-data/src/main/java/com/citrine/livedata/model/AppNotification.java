package com.citrine.livedata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.LinkedHashMap;
import java.util.Map;

public class AppNotification {
    private final int schemaVersion = 1;
    private final String id;
    private final String recipientId;
    private final String type;
    private final String title;
    private final String body;
    private final String createdAt;
    private final String destination;
    private final String sessionId;
    private final boolean demo;
    private volatile boolean read;
    private volatile String pushStatus;

    public AppNotification(
            String id,
            String recipientId,
            String type,
            String title,
            String body,
            String createdAt,
            String destination,
            String sessionId,
            boolean demo
    ) {
        this.id = id;
        this.recipientId = recipientId;
        this.type = type;
        this.title = title;
        this.body = body;
        this.createdAt = createdAt;
        this.destination = destination;
        this.sessionId = sessionId;
        this.demo = demo;
        this.pushStatus = "PENDING";
    }

    public int getSchemaVersion() { return schemaVersion; }
    public String getId() { return id; }
    public String getRecipientId() { return recipientId; }
    public String getType() { return type; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public String getCreatedAt() { return createdAt; }
    public String getDestination() { return destination; }
    public String getSessionId() { return sessionId; }
    public boolean isDemo() { return demo; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public String getPushStatus() { return pushStatus; }
    public void setPushStatus(String pushStatus) { this.pushStatus = pushStatus; }

    @JsonIgnore
    public Map<String, String> toFcmData() {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("schemaVersion", String.valueOf(schemaVersion));
        data.put("id", id);
        data.put("recipientId", recipientId);
        data.put("type", type);
        data.put("title", title);
        data.put("body", body);
        data.put("createdAt", createdAt);
        data.put("destination", destination);
        data.put("demo", String.valueOf(demo));
        if (sessionId != null && !sessionId.isBlank()) {
            data.put("sessionId", sessionId);
        }
        return data;
    }
}
