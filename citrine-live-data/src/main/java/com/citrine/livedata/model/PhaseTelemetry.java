package com.citrine.livedata.model;

public class PhaseTelemetry {
    private final String phase;
    private Double energyWh;
    private Double powerW;
    private Double currentA;
    private Double voltageV;

    public PhaseTelemetry(String phase) {
        this.phase = phase;
    }

    public PhaseTelemetry(PhaseTelemetry source) {
        this.phase = source.phase;
        this.energyWh = source.energyWh;
        this.powerW = source.powerW;
        this.currentA = source.currentA;
        this.voltageV = source.voltageV;
    }

    public String getPhase() {
        return phase;
    }

    public Double getEnergyWh() {
        return energyWh;
    }

    public void setEnergyWh(Double energyWh) {
        this.energyWh = energyWh;
    }

    public Double getPowerW() {
        return powerW;
    }

    public void setPowerW(Double powerW) {
        this.powerW = powerW;
    }

    public Double getCurrentA() {
        return currentA;
    }

    public void setCurrentA(Double currentA) {
        this.currentA = currentA;
    }

    public Double getVoltageV() {
        return voltageV;
    }

    public void setVoltageV(Double voltageV) {
        this.voltageV = voltageV;
    }
}
