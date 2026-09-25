package com.citrine.livedata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@JsonIgnoreProperties(ignoreUnknown = true)
public class OcppEvent {

    private String ocppConnectionName;
    private String event;
    private String origin;
    private String message;
    private Info info;

    public String getOcppConnectionName() {
        return ocppConnectionName;
    }

    public void setOcppConnectionName(String ocppConnectionName) {
        this.ocppConnectionName = ocppConnectionName;
    }

    public String getEvent() {
        return event;
    }

    public void setEvent(String event) {
        this.event = event;
    }

    public String getOrigin() {
        return origin;
    }

    public void setOrigin(String origin) {
        this.origin = origin;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Info getInfo() {
        return info;
    }

    public void setInfo(Info info) {
        this.info = info;
    }

    @JsonIgnore
    public String action() {
        return info == null ? null : info.getAction();
    }

    @JsonIgnore
    public String protocol() {
        return info == null ? null : info.getProtocol();
    }

    @JsonIgnore
    public String correlationId() {
        return info == null ? null : info.getCorrelationId();
    }

    @JsonIgnore
    public String timestamp() {
        return info == null ? null : info.getTimestamp();
    }

    @JsonIgnore
    public JsonNode parseFrame(ObjectMapper objectMapper) {
        if (message == null || message.isBlank()) {
            return null;
        }

        try {
            JsonNode frame = objectMapper.readTree(message);
            return frame.isArray() ? frame : null;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid OCPP message JSON", exception);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Info {
        private String correlationId;
        private String origin;
        private String timestamp;
        private String protocol;
        private String action;
        private String type;

        public String getCorrelationId() {
            return correlationId;
        }

        public void setCorrelationId(String correlationId) {
            this.correlationId = correlationId;
        }

        public String getOrigin() {
            return origin;
        }

        public void setOrigin(String origin) {
            this.origin = origin;
        }

        public String getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }

        public String getProtocol() {
            return protocol;
        }

        public void setProtocol(String protocol) {
            this.protocol = protocol;
        }

        public String getAction() {
            return action;
        }

        public void setAction(String action) {
            this.action = action;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }
    }
}
