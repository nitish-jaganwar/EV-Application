package com.citrine.livedata.service;

import com.citrine.livedata.model.ChargerState;
import com.citrine.livedata.model.OcppEvent;
import com.citrine.livedata.model.PhaseTelemetry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

public class OcppEventService {

    private static final int MAX_EVENTS = 100;
    private static final List<String> PHASES = List.of("L1", "L2", "L3");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, ChargerState> states = new ConcurrentHashMap<>();
    private final Map<String, Object> stateLocks = new ConcurrentHashMap<>();
    private final Map<String, OcppEvent> latestRawEvents = new ConcurrentHashMap<>();
    private final Map<String, ConcurrentLinkedDeque<OcppEvent>> eventHistory =
            new ConcurrentHashMap<>();
    private final ChargingNotificationService notificationService;

    public OcppEventService(ChargingNotificationService notificationService) {
        this.notificationService = notificationService;
    }

    public void processEvent(OcppEvent event) {
        String chargerId = validate(event);
        appendRawEvent(chargerId, event);

        Object lock = stateLocks.computeIfAbsent(chargerId, ignored -> new Object());
        synchronized (lock) {
            ChargerState state = states.computeIfAbsent(chargerId, ChargerState::new);
            ChargerState previous = new ChargerState(state);
            state.setUpdatedAt(timestamp(event));

            String eventName = event.getEvent();
            if ("connect".equalsIgnoreCase(eventName)) {
                markOnline(state, event);
                notificationService.onStateChanged(previous, new ChargerState(state), event);
                return;
            }
            if ("close".equalsIgnoreCase(eventName)
                    || "disconnect".equalsIgnoreCase(eventName)) {
                state.setOnline(false);
                notificationService.onStateChanged(previous, new ChargerState(state), event);
                return;
            }

            JsonNode frame = event.parseFrame(objectMapper);
            if (frame == null) {
                return;
            }

            int messageType = requiredInt(frame, 0, "message type");
            if (messageType != 2) {
                // CallResult/CallError belong to command tracking. They must not
                // overwrite charger telemetry.
                return;
            }

            // CitrineOS also sends callbacks for commands originating from the
            // CSMS. Those frames are useful for command tracking but are not
            // charger telemetry and must not mark the charger online or change
            // its measured state.
            if (!"cs".equalsIgnoreCase(event.getOrigin())) {
                return;
            }

            if (frame.size() < 4 || !frame.get(3).isObject()) {
                throw new IllegalArgumentException("OCPP Call frame has no payload");
            }

            String action = text(frame.get(2));
            JsonNode payload = frame.get(3);
            markOnline(state, event);

            switch (action) {
                case "Heartbeat" -> state.setLastSeenAt(timestamp(event));
                case "StatusNotification" -> applyStatusNotification(state, payload, event);
                case "TransactionEvent" -> applyTransactionEvent(state, payload, event);
                case "MeterValues" -> applyMeterValues(state, payload, event);
                default -> {
                    // Other OCPP Calls remain in raw history but do not alter the
                    // stable telemetry snapshot.
                }
            }
            notificationService.onStateChanged(previous, new ChargerState(state), event);
        }
    }

    public List<String> getChargers() {
        List<String> chargers = new ArrayList<>(states.keySet());
        Collections.sort(chargers);
        return chargers;
    }

    public ChargerState getChargerState(String chargerId) {
        ChargerState state = states.get(chargerId);
        if (state == null) {
            return null;
        }
        Object lock = stateLocks.get(chargerId);
        synchronized (lock) {
            return new ChargerState(state);
        }
    }

    public OcppEvent getLatestRawEvent(String chargerId) {
        return latestRawEvents.get(chargerId);
    }

    public List<OcppEvent> getEvents(String chargerId) {
        ConcurrentLinkedDeque<OcppEvent> events = eventHistory.get(chargerId);
        return events == null ? Collections.emptyList() : new ArrayList<>(events);
    }

    private String validate(OcppEvent event) {
        if (event == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        String chargerId = event.getOcppConnectionName();
        if (chargerId == null || chargerId.isBlank()) {
            throw new IllegalArgumentException("ocppConnectionName is required");
        }
        return chargerId.trim();
    }

    private void appendRawEvent(String chargerId, OcppEvent event) {
        latestRawEvents.put(chargerId, event);
        ConcurrentLinkedDeque<OcppEvent> events = eventHistory.computeIfAbsent(
                chargerId, ignored -> new ConcurrentLinkedDeque<>());
        events.addLast(event);
        while (events.size() > MAX_EVENTS) {
            events.pollFirst();
        }
    }

    private void markOnline(ChargerState state, OcppEvent event) {
        state.setOnline(true);
        state.setLastSeenAt(timestamp(event));
    }

    private void applyStatusNotification(
            ChargerState state,
            JsonNode payload,
            OcppEvent event
    ) {
        setInteger(payload, "evseId", state::setEvseId);
        setInteger(payload, "connectorId", state::setConnectorId);

        String status = firstText(payload, "connectorStatus", "status");
        if (status != null) {
            state.setConnectorStatus(status);
        }

        String errorCode = textOrNull(payload.get("errorCode"));
        if (errorCode != null) {
            state.setChargerErrorCode(errorCode);
        }
        state.setUpdatedAt(firstText(payload, "timestamp") != null
                ? firstText(payload, "timestamp") : timestamp(event));
    }

    private void applyTransactionEvent(
            ChargerState state,
            JsonNode payload,
            OcppEvent event
    ) {
        JsonNode transaction = payload.path("transactionInfo");
        String incomingTransactionId = textOrNull(transaction.get("transactionId"));
        long incomingSeqNo = payload.path("seqNo").asLong(-1);
        boolean sameTransaction = incomingTransactionId != null
                && incomingTransactionId.equals(state.getTransactionId());

        if (sameTransaction
                && incomingSeqNo >= 0
                && state.getLastTransactionSeqNo() != null
                && incomingSeqNo < state.getLastTransactionSeqNo()) {
            return;
        }

        String eventType = textOrNull(payload.get("eventType"));
        String payloadTimestamp = firstText(payload, "timestamp");

        if (incomingTransactionId != null) {
            state.setTransactionId(incomingTransactionId);
        }
        if (incomingSeqNo >= 0) {
            state.setLastTransactionSeqNo(incomingSeqNo);
        }
        state.setTransactionEventType(eventType);

        String chargingState = textOrNull(transaction.get("chargingState"));
        if (chargingState != null) {
            state.setChargingState(chargingState);
        }
        if (transaction.has("timeSpentCharging")
                && transaction.get("timeSpentCharging").canConvertToLong()) {
            state.setChargingSeconds(transaction.get("timeSpentCharging").asLong());
        }

        JsonNode evse = payload.path("evse");
        setInteger(evse, "id", state::setEvseId);
        setInteger(evse, "connectorId", state::setConnectorId);

        applyMeterValueArray(state, payload.path("meterValue"), payloadTimestamp);

        if ("Started".equals(eventType)) {
            state.setTransactionStartedAt(payloadTimestamp);
            state.setSessionStartEnergyWh(state.getTotalEnergyWh());
            state.setEnergyDeliveredWh(0.0);
        } else {
            updateDeliveredEnergy(state);
        }

        if ("Ended".equals(eventType)) {
            if (chargingState == null) {
                state.setChargingState("Idle");
            }
            state.setTotalPowerW(0.0);
        }

        state.setUpdatedAt(payloadTimestamp != null ? payloadTimestamp : timestamp(event));
    }

    private void applyMeterValues(
            ChargerState state,
            JsonNode payload,
            OcppEvent event
    ) {
        setInteger(payload, "connectorId", state::setConnectorId);
        String transactionId = textOrNull(payload.get("transactionId"));
        if (transactionId != null) {
            state.setTransactionId(transactionId);
        }
        applyMeterValueArray(state, payload.path("meterValue"), timestamp(event));
        updateDeliveredEnergy(state);
    }

    private void applyMeterValueArray(
            ChargerState state,
            JsonNode meterValues,
            String fallbackTimestamp
    ) {
        if (!meterValues.isArray()) {
            return;
        }

        for (JsonNode meterValue : meterValues) {
            String meterTimestamp = textOrNull(meterValue.get("timestamp"));
            state.setMeterTimestamp(meterTimestamp != null
                    ? meterTimestamp : fallbackTimestamp);
            applySampledValues(state, meterValue.path("sampledValue"));
        }
    }

    private void applySampledValues(ChargerState state, JsonNode sampledValues) {
        if (!sampledValues.isArray()) {
            return;
        }

        boolean aggregatePowerReported = false;
        double phasePowerTotal = 0.0;
        int phasePowerCount = 0;

        for (JsonNode sample : sampledValues) {
            String measurand = textOrNull(sample.get("measurand"));
            Double value = measurementValue(sample);
            if (measurand == null || value == null) {
                continue;
            }

            if ("Temperature".equals(measurand)) {
                state.setTemperatureC(toCelsius(sample, value));
                continue;
            }

            String phase = normalizePhase(textOrNull(sample.get("phase")));
            if (phase == null) {
                switch (measurand) {
                    case "Energy.Active.Import.Register" -> state.setTotalEnergyWh(value);
                    case "Power.Active.Import" -> {
                        state.setTotalPowerW(value);
                        aggregatePowerReported = true;
                    }
                    case "SoC" -> state.setSocPercent(value);
                    case "Frequency" -> state.setFrequencyHz(value);
                    case "Current.Offered" -> state.setAppliedCurrentLimitA(value);
                    default -> { }
                }
                continue;
            }

            PhaseTelemetry phaseTelemetry = state.phase(phase);
            if (phaseTelemetry == null) {
                continue;
            }
            switch (measurand) {
                case "Energy.Active.Import.Register" -> phaseTelemetry.setEnergyWh(value);
                case "Power.Active.Import" -> {
                    phaseTelemetry.setPowerW(value);
                    phasePowerTotal += value;
                    phasePowerCount++;
                }
                case "Current.Import" -> phaseTelemetry.setCurrentA(value);
                case "Voltage" -> phaseTelemetry.setVoltageV(value);
                default -> { }
            }
        }

        if (!aggregatePowerReported && phasePowerCount > 0) {
            state.setTotalPowerW(phasePowerTotal);
        }
    }

    private Double measurementValue(JsonNode sample) {
        JsonNode valueNode = sample.get("value");
        if (valueNode == null || valueNode.isNull()) {
            return null;
        }
        try {
            double value = valueNode.isNumber()
                    ? valueNode.asDouble()
                    : Double.parseDouble(valueNode.asText());
            JsonNode unit = sample.path("unitOfMeasure");
            int multiplier = unit.path("multiplier").asInt(0);
            return value * Math.pow(10.0, multiplier);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private Double toCelsius(JsonNode sample, Double value) {
        String unit = textOrNull(sample.path("unitOfMeasure").get("unit"));
        if (unit == null || "Celsius".equalsIgnoreCase(unit) || "Cel".equalsIgnoreCase(unit)) {
            return value;
        }
        if ("Fahrenheit".equalsIgnoreCase(unit) || "Fah".equalsIgnoreCase(unit)) {
            return (value - 32.0) * 5.0 / 9.0;
        }
        if ("K".equalsIgnoreCase(unit) || "Kelvin".equalsIgnoreCase(unit)) {
            return value - 273.15;
        }
        return value;
    }

    private void updateDeliveredEnergy(ChargerState state) {
        if (state.getSessionStartEnergyWh() == null || state.getTotalEnergyWh() == null) {
            return;
        }
        state.setEnergyDeliveredWh(Math.max(
                0.0,
                state.getTotalEnergyWh() - state.getSessionStartEnergyWh()
        ));
    }

    private String normalizePhase(String phase) {
        if (phase == null) {
            return null;
        }
        String normalized = phase.split("-")[0];
        return PHASES.contains(normalized) ? normalized : null;
    }

    private String timestamp(OcppEvent event) {
        String timestamp = event.timestamp();
        return timestamp == null || timestamp.isBlank()
                ? Instant.now().toString() : timestamp;
    }

    private int requiredInt(JsonNode array, int index, String name) {
        if (array.size() <= index || !array.get(index).canConvertToInt()) {
            throw new IllegalArgumentException("OCPP frame has invalid " + name);
        }
        return array.get(index).asInt();
    }

    private String text(JsonNode node) {
        String value = textOrNull(node);
        if (value == null) {
            throw new IllegalArgumentException("OCPP frame action is required");
        }
        return value;
    }

    private String textOrNull(JsonNode node) {
        return node == null || node.isNull() ? null : node.asText();
    }

    private String firstText(JsonNode node, String... names) {
        for (String name : names) {
            String value = textOrNull(node.get(name));
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private void setInteger(JsonNode node, String name, IntegerConsumer consumer) {
        JsonNode value = node.get(name);
        if (value != null && value.canConvertToInt()) {
            consumer.accept(value.asInt());
        }
    }

    @FunctionalInterface
    private interface IntegerConsumer {
        void accept(Integer value);
    }
}
