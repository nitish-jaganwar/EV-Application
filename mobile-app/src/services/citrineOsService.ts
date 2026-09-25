export type Ocpp16Phase = 'L1' | 'L2' | 'L3';
export type ChargerStatus =
  | 'Available'
  | 'Reserved'
  | 'Preparing'
  | 'Charging'
  | 'SuspendedEV'
  | 'SuspendedEVSE'
  | 'Finishing'
  | 'Unavailable'
  | 'Faulted';
export type MeterMeasurand =
  | 'Energy.Active.Import.Register'
  | 'Power.Active.Import'
  | 'Current.Import'
  | 'Voltage';

/** Raw OCPP 1.6 MeterValues message received from CitrineOS. */
export interface CitrineOcpp16MeterValuesEvent {
  origin: 'cs';
  eventGroup: 'router';
  action: 'MeterValues';
  context: {
    ocppConnectionName: string;
    correlationId: string;
    tenantId: number;
    timestamp: string;
  };
  state: number;
  protocol: 'ocpp1.6';
  payload: {
    connectorId: number;
    transactionId?: number | string;
    meterValue: Array<{
      timestamp: string;
      sampledValue: Array<{
        context: 'Sample.Periodic' | string;
        format: 'Raw' | string;
        location: 'Outlet' | string;
        measurand: MeterMeasurand | string;
        phase?: Ocpp16Phase;
        unit: 'Wh' | 'W' | 'A' | 'V' | string;
        value: string;
      }>;
    }>;
  };
}

/** Raw OCPP 1.6 StatusNotification message received from CitrineOS. */
export interface CitrineOcpp16StatusEvent {
  connectorId: number;
  errorCode: string;
  status: ChargerStatus;
  timestamp: string;
}

export interface PhaseTelemetry {
  phase: Ocpp16Phase;
  energyWh?: number;
  powerW?: number;
  currentA?: number;
  voltageV?: number;
}

/** Stable mobile-app model. UI code should consume this instead of raw OCPP arrays. */
export interface ChargerTelemetry {
  chargerId?: string;
  evseId?: number;
  connectorId: number;
  online?: boolean;
  lastSeenAt?: string;
  transactionId?: number | string;
  transactionEventType?: string;
  transactionStartedAt?: string;
  chargingSeconds?: number;
  meterTimestamp: string;
  chargerStatus: ChargerStatus;
  chargerStatusTimestamp: string;
  chargerErrorCode: string;
  totalEnergyWh?: number;
  sessionStartEnergyWh?: number;
  energyDeliveredWh?: number;
  totalPowerW?: number;
  frequencyHz?: number;
  temperatureC?: number;
  appliedCurrentLimitA?: number;
  gridLoadW?: number;
  siteCapacityW?: number;
  availablePowerW?: number;
  phases: PhaseTelemetry[];
}

export interface ResolvedChargerStatus {
  status: ChargerStatus;
  source: 'status' | 'meter';
}

// UI heuristic for meaningful power delivery, not an OCPP-defined threshold.
const CHARGING_POWER_THRESHOLD_W = 100;

/**
 * Reconciles the supplied events for display without overwriting the reported state.
 * This compares event order only; it does not establish that a charger is online.
 */
export function resolveChargerStatus(telemetry: ChargerTelemetry): ResolvedChargerStatus {
  const reportedStatus: ResolvedChargerStatus = {
    status: telemetry.chargerStatus,
    source: 'status',
  };

  if (
    telemetry.chargerErrorCode !== 'NoError'
    || telemetry.chargerStatus === 'Faulted'
    || telemetry.chargerStatus === 'Unavailable'
    || telemetry.chargerStatus === 'Finishing'
    || telemetry.chargerStatus === 'Charging'
  ) {
    return reportedStatus;
  }

  const meterTimestamp = Date.parse(telemetry.meterTimestamp);
  const statusTimestamp = Date.parse(telemetry.chargerStatusTimestamp);
  const powerW = telemetry.totalPowerW;
  if (
    Number.isFinite(meterTimestamp)
    && Number.isFinite(statusTimestamp)
    && meterTimestamp > statusTimestamp
    && powerW !== undefined
    && Number.isFinite(powerW)
    && powerW > CHARGING_POWER_THRESHOLD_W
  ) {
    return { status: 'Charging', source: 'meter' };
  }

  return reportedStatus;
}

export interface CompletedChargingSession {
  transactionId: number | string;
  connectorId: number;
  startedAt: string;
  endedAt: string;
  startMeterWh: number;
  finalMeterWh: number;
  energyConsumedWh: number;
  stopReason: string;
}

const toNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const findSample = (
  values: CitrineOcpp16MeterValuesEvent['payload']['meterValue'][number]['sampledValue'],
  measurand: MeterMeasurand,
  phase?: Ocpp16Phase,
) => values.find((sample) => sample.measurand === measurand && sample.phase === phase);

/** Maps the latest CitrineOS OCPP 1.6 events into data ready for the mobile UI. */
export function normalizeChargerTelemetry(
  meterValuesEvent: CitrineOcpp16MeterValuesEvent,
  statusEvent: CitrineOcpp16StatusEvent,
): ChargerTelemetry {
  if (meterValuesEvent.payload.connectorId !== statusEvent.connectorId) {
    throw new Error('MeterValues and StatusNotification must refer to the same connector.');
  }

  const latestMeterValue = meterValuesEvent.payload.meterValue.at(-1);
  if (!latestMeterValue) {
    throw new Error('MeterValues payload must include at least one meterValue entry.');
  }

  const values = latestMeterValue.sampledValue;
  return {
    connectorId: meterValuesEvent.payload.connectorId,
    transactionId: meterValuesEvent.payload.transactionId,
    meterTimestamp: latestMeterValue.timestamp,
    chargerStatus: statusEvent.status,
    chargerStatusTimestamp: statusEvent.timestamp,
    chargerErrorCode: statusEvent.errorCode,
    totalEnergyWh: toNumber(findSample(values, 'Energy.Active.Import.Register')?.value),
    totalPowerW: toNumber(findSample(values, 'Power.Active.Import')?.value),
    phases: (['L1', 'L2', 'L3'] as const).map((phase) => ({
      phase,
      energyWh: toNumber(findSample(values, 'Energy.Active.Import.Register', phase)?.value),
      powerW: toNumber(findSample(values, 'Power.Active.Import', phase)?.value),
      currentA: toNumber(findSample(values, 'Current.Import', phase)?.value),
      voltageV: toNumber(findSample(values, 'Voltage', phase)?.value),
    })),
  };
}

/** Calculates session energy from the start and final cumulative meter readings. */
export function createCompletedChargingSession(input: Omit<CompletedChargingSession, 'energyConsumedWh'>): CompletedChargingSession {
  return {
    ...input,
    energyConsumedWh: Math.max(0, input.finalMeterWh - input.startMeterWh),
  };
}

// Local development fixture based on the supplied CitrineOS OCPP 1.6 payload.
export const MOCK_METER_VALUES_EVENT: CitrineOcpp16MeterValuesEvent = {
  origin: 'cs',
  eventGroup: 'router',
  action: 'MeterValues',
  context: {
    ocppConnectionName: 'cp002',
    correlationId: 'be3c439d-431b-4eaa-9508-e7c7206be358',
    tenantId: 1,
    timestamp: '2026-09-06T00:17:12.966Z',
  },
  state: 1,
  protocol: 'ocpp1.6',
  payload: {
    connectorId: 1,
    transactionId: 2,
    meterValue: [{
      timestamp: '2026-09-06T00:17:12.000Z',
      sampledValue: [
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Energy.Active.Import.Register', unit: 'Wh', value: '117422.00' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Energy.Active.Import.Register', phase: 'L1', unit: 'Wh', value: '39141.00' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Energy.Active.Import.Register', phase: 'L2', unit: 'Wh', value: '39141.00' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Energy.Active.Import.Register', phase: 'L3', unit: 'Wh', value: '39141.00' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Power.Active.Import', unit: 'W', value: '10710.00' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Power.Active.Import', phase: 'L1', unit: 'W', value: '3570.00' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Power.Active.Import', phase: 'L2', unit: 'W', value: '3570.00' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Power.Active.Import', phase: 'L3', unit: 'W', value: '3570.00' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Current.Import', phase: 'L1', unit: 'A', value: '16.04' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Current.Import', phase: 'L2', unit: 'A', value: '16.04' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Current.Import', phase: 'L3', unit: 'A', value: '16.04' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Voltage', phase: 'L1', unit: 'V', value: '222.56' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Voltage', phase: 'L2', unit: 'V', value: '222.56' },
        { context: 'Sample.Periodic', format: 'Raw', location: 'Outlet', measurand: 'Voltage', phase: 'L3', unit: 'V', value: '222.56' },
      ],
    }],
  },
};

export const MOCK_STATUS_EVENT: CitrineOcpp16StatusEvent = {
  connectorId: 1,
  errorCode: 'NoError',
  status: 'Available',
  timestamp: '2026-09-04T11:43:55.015Z',
};

export const MOCK_CHARGER_TELEMETRY = normalizeChargerTelemetry(MOCK_METER_VALUES_EVENT, MOCK_STATUS_EVENT);
