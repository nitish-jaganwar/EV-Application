package com.citrine.livedata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ChargerState {
    private final String chargerId;
    private int tenantId = 1;
    private boolean online;
    private Integer evseId;
    private Integer connectorId;
    private String connectorStatus = "Unavailable";
    private String chargerErrorCode = "NoError";
    private String chargingState = "Idle";
    private String transactionEventType;
    private String transactionId;
    private String transactionStartedAt;
    private Long chargingSeconds;
    private Long lastTransactionSeqNo;
    private Double totalEnergyWh;
    private Double sessionStartEnergyWh;
    private Double energyDeliveredWh;
    private Double totalPowerW;
    private Double socPercent;
    private Double frequencyHz;
    private Double temperatureC;
    private Double appliedCurrentLimitA;
    private Double gridLoadW;
    private Double siteCapacityW;
    private Double availablePowerW;
    private String meterTimestamp;
    private String lastSeenAt;
    private String updatedAt;

    @JsonIgnore
    private final Map<String, PhaseTelemetry> phaseMap = new LinkedHashMap<>();

    public ChargerState(String chargerId) {
        this.chargerId = chargerId;
        phaseMap.put("L1", new PhaseTelemetry("L1"));
        phaseMap.put("L2", new PhaseTelemetry("L2"));
        phaseMap.put("L3", new PhaseTelemetry("L3"));
    }

    public ChargerState(ChargerState source) {
        this(source.chargerId);
        this.tenantId = source.tenantId;
        this.online = source.online;
        this.evseId = source.evseId;
        this.connectorId = source.connectorId;
        this.connectorStatus = source.connectorStatus;
        this.chargerErrorCode = source.chargerErrorCode;
        this.chargingState = source.chargingState;
        this.transactionEventType = source.transactionEventType;
        this.transactionId = source.transactionId;
        this.transactionStartedAt = source.transactionStartedAt;
        this.chargingSeconds = source.chargingSeconds;
        this.lastTransactionSeqNo = source.lastTransactionSeqNo;
        this.totalEnergyWh = source.totalEnergyWh;
        this.sessionStartEnergyWh = source.sessionStartEnergyWh;
        this.energyDeliveredWh = source.energyDeliveredWh;
        this.totalPowerW = source.totalPowerW;
        this.socPercent = source.socPercent;
        this.frequencyHz = source.frequencyHz;
        this.temperatureC = source.temperatureC;
        this.appliedCurrentLimitA = source.appliedCurrentLimitA;
        this.gridLoadW = source.gridLoadW;
        this.siteCapacityW = source.siteCapacityW;
        this.availablePowerW = source.availablePowerW;
        this.meterTimestamp = source.meterTimestamp;
        this.lastSeenAt = source.lastSeenAt;
        this.updatedAt = source.updatedAt;
        source.phaseMap.forEach((phase, telemetry) ->
                this.phaseMap.put(phase, new PhaseTelemetry(telemetry)));
    }

    public String getChargerId() { return chargerId; }
    public int getTenantId() { return tenantId; }
    public void setTenantId(int tenantId) { this.tenantId = tenantId; }
    public boolean isOnline() { return online; }
    public void setOnline(boolean online) { this.online = online; }
    public Integer getEvseId() { return evseId; }
    public void setEvseId(Integer evseId) { this.evseId = evseId; }
    public Integer getConnectorId() { return connectorId; }
    public void setConnectorId(Integer connectorId) { this.connectorId = connectorId; }
    public String getConnectorStatus() { return connectorStatus; }
    public void setConnectorStatus(String connectorStatus) { this.connectorStatus = connectorStatus; }
    public String getChargerErrorCode() { return chargerErrorCode; }
    public void setChargerErrorCode(String chargerErrorCode) { this.chargerErrorCode = chargerErrorCode; }
    public String getChargingState() { return chargingState; }
    public void setChargingState(String chargingState) { this.chargingState = chargingState; }
    public String getTransactionEventType() { return transactionEventType; }
    public void setTransactionEventType(String value) { this.transactionEventType = value; }
    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
    public String getTransactionStartedAt() { return transactionStartedAt; }
    public void setTransactionStartedAt(String value) { this.transactionStartedAt = value; }
    public Long getChargingSeconds() { return chargingSeconds; }
    public void setChargingSeconds(Long chargingSeconds) { this.chargingSeconds = chargingSeconds; }
    public Long getLastTransactionSeqNo() { return lastTransactionSeqNo; }
    public void setLastTransactionSeqNo(Long value) { this.lastTransactionSeqNo = value; }
    public Double getTotalEnergyWh() { return totalEnergyWh; }
    public void setTotalEnergyWh(Double totalEnergyWh) { this.totalEnergyWh = totalEnergyWh; }
    public Double getSessionStartEnergyWh() { return sessionStartEnergyWh; }
    public void setSessionStartEnergyWh(Double value) { this.sessionStartEnergyWh = value; }
    public Double getEnergyDeliveredWh() { return energyDeliveredWh; }
    public void setEnergyDeliveredWh(Double value) { this.energyDeliveredWh = value; }
    public Double getTotalPowerW() { return totalPowerW; }
    public void setTotalPowerW(Double totalPowerW) { this.totalPowerW = totalPowerW; }
    public Double getSocPercent() { return socPercent; }
    public void setSocPercent(Double socPercent) { this.socPercent = socPercent; }
    public Double getFrequencyHz() { return frequencyHz; }
    public void setFrequencyHz(Double frequencyHz) { this.frequencyHz = frequencyHz; }
    public Double getTemperatureC() { return temperatureC; }
    public void setTemperatureC(Double temperatureC) { this.temperatureC = temperatureC; }
    public Double getAppliedCurrentLimitA() { return appliedCurrentLimitA; }
    public void setAppliedCurrentLimitA(Double appliedCurrentLimitA) { this.appliedCurrentLimitA = appliedCurrentLimitA; }
    public Double getGridLoadW() { return gridLoadW; }
    public void setGridLoadW(Double gridLoadW) { this.gridLoadW = gridLoadW; }
    public Double getSiteCapacityW() { return siteCapacityW; }
    public void setSiteCapacityW(Double siteCapacityW) { this.siteCapacityW = siteCapacityW; }
    public Double getAvailablePowerW() { return availablePowerW; }
    public void setAvailablePowerW(Double availablePowerW) { this.availablePowerW = availablePowerW; }
    public String getMeterTimestamp() { return meterTimestamp; }
    public void setMeterTimestamp(String meterTimestamp) { this.meterTimestamp = meterTimestamp; }
    public String getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(String lastSeenAt) { this.lastSeenAt = lastSeenAt; }
    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
    public List<PhaseTelemetry> getPhases() { return new ArrayList<>(phaseMap.values()); }
    @JsonIgnore public PhaseTelemetry phase(String phase) { return phaseMap.get(phase); }
}
