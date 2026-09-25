export type ChargingState = 'Charging' | 'EVConnected' | 'SuspendedEV' | 'SuspendedEVSE' | 'Idle' | 'Stopped';

type OcppPhase = 'L1' | 'L2' | 'L3' | 'L1-N' | 'L2-N' | 'L3-N';

interface SampledValue {
  value: number | string;
  measurand: string;
  phase?: OcppPhase;
  unitOfMeasure?: { unit: string };
}

interface MeterValue {
  timestamp: string;
  sampledValue: SampledValue[];
}

interface TransactionEvent {
  eventType: 'Started' | 'Updated' | 'Ended';
  timestamp: string;
  transactionInfo: {
    transactionId: string;
    chargingState: ChargingState;
    timeSpentCharging?: number;
  };
  evse: { id: number; connectorId: number };
  meterValue: MeterValue[];
}

export interface PhaseReading {
  phase: 'L1' | 'L2' | 'L3';
  voltageV?: number;
  currentA?: number;
}

export interface ChargingSessionSnapshot {
  transactionId: string;
  chargingState: ChargingState;
  evseId: number;
  connectorId: number;
  startTime: string;
  elapsedSeconds: number;
  energyDeliveredWh: number;
  powerW?: number;
  batteryPercent?: number;
  phaseReadings: PhaseReading[];
}

const asNumber = (value: number | string) => Number(value);

const phaseName = (phase?: OcppPhase): PhaseReading['phase'] | undefined => {
  if (!phase) return undefined;
  return phase.split('-')[0] as PhaseReading['phase'];
};

const findSample = (values: SampledValue[], measurand: string) =>
  values.find((sample) => sample.measurand === measurand);

/** Converts CitrineOS OCPP TransactionEvent data into the app's display model. */
export function buildChargingSession(started: TransactionEvent, updated: TransactionEvent): ChargingSessionSnapshot {
  const startValues = started.meterValue.flatMap((value) => value.sampledValue);
  const currentValues = updated.meterValue.flatMap((value) => value.sampledValue);
  const startEnergy = findSample(startValues, 'Energy.Active.Import.Register');
  const latestEnergy = findSample(currentValues, 'Energy.Active.Import.Register');
  const readings = new Map<PhaseReading['phase'], PhaseReading>();

  currentValues.forEach((sample) => {
    const phase = phaseName(sample.phase);
    if (!phase) return;
    const reading = readings.get(phase) ?? { phase };
    if (sample.measurand === 'Voltage') reading.voltageV = asNumber(sample.value);
    if (sample.measurand === 'Current.Import') reading.currentA = asNumber(sample.value);
    readings.set(phase, reading);
  });

  const power = findSample(currentValues, 'Power.Active.Import');
  const battery = findSample(currentValues, 'SoC');
  return {
    transactionId: updated.transactionInfo.transactionId,
    chargingState: updated.transactionInfo.chargingState,
    evseId: updated.evse.id,
    connectorId: updated.evse.connectorId,
    startTime: started.timestamp,
    elapsedSeconds: updated.transactionInfo.timeSpentCharging ?? Math.max(0, (Date.parse(updated.timestamp) - Date.parse(started.timestamp)) / 1000),
    energyDeliveredWh: Math.max(0, asNumber(latestEnergy?.value ?? 0) - asNumber(startEnergy?.value ?? 0)),
    powerW: power ? asNumber(power.value) : undefined,
    batteryPercent: battery ? asNumber(battery.value) : undefined,
    phaseReadings: ['L1', 'L2', 'L3'].map((phase) => readings.get(phase as PhaseReading['phase'])).filter((reading): reading is PhaseReading => Boolean(reading)),
  };
}

const startedEvent: TransactionEvent = {
  eventType: 'Started', timestamp: '2026-09-09T06:05:00Z',
  transactionInfo: { transactionId: 'TX-1001', chargingState: 'EVConnected' }, evse: { id: 1, connectorId: 1 },
  meterValue: [{ timestamp: '2026-09-09T06:05:00Z', sampledValue: [{ value: 15432, measurand: 'Energy.Active.Import.Register', unitOfMeasure: { unit: 'Wh' } }] }],
};

const updatedEvent: TransactionEvent = {
  eventType: 'Updated', timestamp: '2026-09-09T06:10:00Z',
  transactionInfo: { transactionId: 'TX-1001', chargingState: 'Charging', timeSpentCharging: 300 }, evse: { id: 1, connectorId: 1 },
  meterValue: [{
    timestamp: '2026-09-09T06:10:00Z',
    sampledValue: [
      { value: 17482, measurand: 'Energy.Active.Import.Register', unitOfMeasure: { unit: 'Wh' } },
      { value: 7240, measurand: 'Power.Active.Import', unitOfMeasure: { unit: 'W' } },
      { value: 31.4, measurand: 'Current.Import', phase: 'L1', unitOfMeasure: { unit: 'A' } },
      { value: 230.8, measurand: 'Voltage', phase: 'L1-N', unitOfMeasure: { unit: 'V' } },
      { value: 230.9, measurand: 'Voltage', phase: 'L2-N', unitOfMeasure: { unit: 'V' } },
      { value: 232.1, measurand: 'Voltage', phase: 'L3-N', unitOfMeasure: { unit: 'V' } },
      { value: 62, measurand: 'SoC', unitOfMeasure: { unit: 'Percent' } },
    ],
  }],
};

export const MOCK_CHARGING_SESSION = buildChargingSession(startedEvent, updatedEvent);
