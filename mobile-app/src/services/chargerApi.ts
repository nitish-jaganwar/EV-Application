import type { ChargerStatus, ChargerTelemetry, PhaseTelemetry } from '@/services/citrineOsService';

const DEFAULT_API_BASE_URL = 'http://65.21.108.234:9100';
const REQUEST_TIMEOUT_MS = 8_000;

export const CHARGER_API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, '');

export const POC_CHARGER_ID = process.env.EXPO_PUBLIC_CHARGER_ID || 'cp001';

const configuredPollInterval = Number(process.env.EXPO_PUBLIC_CHARGER_POLL_INTERVAL_MS);
export const CHARGER_POLL_INTERVAL_MS = Number.isFinite(configuredPollInterval)
  && configuredPollInterval >= 2_000
  ? configuredPollInterval
  : 10_000;

export const USE_MOCK_CHARGER = process.env.EXPO_PUBLIC_USE_MOCK_CHARGER === 'true';

interface BackendPhaseTelemetry {
  phase: string;
  energyWh: number | null;
  powerW: number | null;
  currentA: number | null;
  voltageV: number | null;
}

export interface BackendChargerState {
  chargerId: string;
  tenantId: number;
  online: boolean;
  evseId: number | null;
  connectorId: number | null;
  connectorStatus: string | null;
  chargerErrorCode: string | null;
  chargingState: string | null;
  transactionEventType: string | null;
  transactionId: string | null;
  transactionStartedAt: string | null;
  chargingSeconds: number | null;
  lastTransactionSeqNo: number | null;
  totalEnergyWh: number | null;
  sessionStartEnergyWh: number | null;
  energyDeliveredWh: number | null;
  totalPowerW: number | null;
  socPercent: number | null;
  frequencyHz?: number | null;
  temperatureC?: number | null;
  appliedCurrentLimitA?: number | null;
  gridLoadW?: number | null;
  siteCapacityW?: number | null;
  availablePowerW?: number | null;
  meterTimestamp: string | null;
  lastSeenAt: string | null;
  updatedAt: string | null;
  phases: BackendPhaseTelemetry[];
}

const PHASES = ['L1', 'L2', 'L3'] as const;
const CHARGER_STATUSES: ChargerStatus[] = [
  'Available',
  'Reserved',
  'Preparing',
  'Charging',
  'SuspendedEV',
  'SuspendedEVSE',
  'Finishing',
  'Unavailable',
  'Faulted',
];

const optionalNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const statusFromBackend = (state: BackendChargerState): ChargerStatus => {
  if (!state.online) return 'Unavailable';
  if (state.chargerErrorCode && state.chargerErrorCode !== 'NoError') return 'Faulted';

  if (state.chargingState && CHARGER_STATUSES.includes(state.chargingState as ChargerStatus)) {
    return state.chargingState as ChargerStatus;
  }

  if (state.chargingState === 'EVConnected') return 'Preparing';
  if (state.chargingState === 'Stopped') return 'Finishing';

  const connectorStatus = state.connectorStatus ?? '';
  if (CHARGER_STATUSES.includes(connectorStatus as ChargerStatus)) {
    return connectorStatus as ChargerStatus;
  }
  return connectorStatus === 'Occupied' ? 'Preparing' : 'Available';
};

const normalizePhases = (phases: BackendPhaseTelemetry[]): PhaseTelemetry[] =>
  PHASES.map((phase) => {
    const reading = phases.find((item) => item.phase === phase);
    return {
      phase,
      energyWh: optionalNumber(reading?.energyWh),
      powerW: optionalNumber(reading?.powerW),
      currentA: optionalNumber(reading?.currentA),
      voltageV: optionalNumber(reading?.voltageV),
    };
  });

const elapsedSeconds = (state: BackendChargerState) => {
  const reported = optionalNumber(state.chargingSeconds);
  if (reported !== undefined) return Math.max(0, Math.floor(reported));
  if (!state.transactionStartedAt) return undefined;

  const end = Date.parse(state.meterTimestamp ?? state.updatedAt ?? '');
  const start = Date.parse(state.transactionStartedAt);
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.floor((end - start) / 1000))
    : undefined;
};

export const mapBackendChargerState = (state: BackendChargerState): ChargerTelemetry => ({
  chargerId: state.chargerId,
  evseId: state.evseId ?? undefined,
  connectorId: state.connectorId ?? 1,
  online: state.online,
  lastSeenAt: state.lastSeenAt ?? undefined,
  transactionId: state.transactionId ?? undefined,
  transactionEventType: state.transactionEventType ?? undefined,
  transactionStartedAt: state.transactionStartedAt ?? undefined,
  chargingSeconds: elapsedSeconds(state),
  meterTimestamp: state.meterTimestamp ?? state.updatedAt ?? new Date().toISOString(),
  chargerStatus: statusFromBackend(state),
  chargerStatusTimestamp: state.updatedAt ?? state.lastSeenAt ?? new Date().toISOString(),
  chargerErrorCode: state.chargerErrorCode ?? 'NoError',
  totalEnergyWh: optionalNumber(state.totalEnergyWh),
  sessionStartEnergyWh: optionalNumber(state.sessionStartEnergyWh),
  energyDeliveredWh: optionalNumber(state.energyDeliveredWh),
  totalPowerW: optionalNumber(state.totalPowerW),
  frequencyHz: optionalNumber(state.frequencyHz),
  temperatureC: optionalNumber(state.temperatureC),
  appliedCurrentLimitA: optionalNumber(state.appliedCurrentLimitA),
  gridLoadW: optionalNumber(state.gridLoadW),
  siteCapacityW: optionalNumber(state.siteCapacityW),
  availablePowerW: optionalNumber(state.availablePowerW),
  phases: normalizePhases(Array.isArray(state.phases) ? state.phases : []),
});

export async function stopChargingTransaction(
  chargerId: string,
  transactionId: number | string,
  connectorId: number,
  evseId?: number,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(
      `${CHARGER_API_BASE_URL}/api/chargers/${encodeURIComponent(chargerId)}/commands/stop`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: String(transactionId), connectorId, evseId }),
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Stop command timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `Stop command failed with HTTP ${response.status}`;
    try {
      const body = await response.json() as { message?: string; error?: string };
      message = body.message || body.error || message;
    } catch {
      // The HTTP status remains useful when the backend has no JSON error body.
    }
    throw new Error(message);
  }
}

const isBackendChargerState = (value: unknown): value is BackendChargerState => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BackendChargerState>;
  return typeof candidate.chargerId === 'string'
    && typeof candidate.online === 'boolean'
    && Array.isArray(candidate.phases);
};

export async function fetchChargerTelemetry(
  chargerId = POC_CHARGER_ID,
  signal?: AbortSignal,
): Promise<ChargerTelemetry> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => timeoutController.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(
      `${CHARGER_API_BASE_URL}/api/chargers/${encodeURIComponent(chargerId)}`,
      { headers: { Accept: 'application/json' }, signal: timeoutController.signal },
    );
    if (!response.ok) {
      throw new Error(`Charger API returned HTTP ${response.status}`);
    }

    const body: unknown = await response.json();
    if (!isBackendChargerState(body)) {
      throw new Error('Charger API returned an invalid state object');
    }
    return mapBackendChargerState(body);
  } catch (error) {
    if (timeoutController.signal.aborted && !signal?.aborted) {
      throw new Error('Charger API request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
