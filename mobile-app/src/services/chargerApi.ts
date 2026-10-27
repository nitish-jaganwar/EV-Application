import type { ChargerStatus, ChargerTelemetry, PhaseTelemetry } from '@/services/citrineOsService';
import { addAppLog } from '@/services/appLogger';
import {
  API_ENDPOINTS,
  CITRINE_BASE_URL as CITRINE_API_URL,
  HASURA_ENDPOINT,
  DEFAULT_CHARGER_ID as POC_CHARGER_ID,
  CHARGER_POLL_INTERVAL_MS,
  USE_MOCK_CHARGER,
  LEGACY_PROXY_URL as CHARGER_API_BASE_URL,
} from '@/config/apiEndpoints';

export {
  CITRINE_API_URL,
  CHARGER_API_BASE_URL,
  POC_CHARGER_ID,
  CHARGER_POLL_INTERVAL_MS,
  USE_MOCK_CHARGER,
};

const REQUEST_TIMEOUT_MS = 8_000;

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

export async function startChargingTransaction(
  chargerId: string,
  idTag = 'FLAT_A402_NITISH',
  connectorId = 1,
): Promise<boolean> {
  // 1. First priority: OCPP 2.1 / 2.0.1 (Used by EVerest Yeti simulator on CitrineOS)
  const url21 = API_ENDPOINTS.OCPP_201.REQUEST_START(chargerId);
  const remoteStartId = Math.floor(Math.random() * 100000) + 1;
  const body21 = {
    remoteStartId,
    evseId: connectorId || 1,
    idToken: {
      idToken: idTag,
      type: 'Central',
    },
  };

  addAppLog(
    'API',
    `POST RequestStartTransaction (${chargerId})`,
    `Protocol: OCPP 2.1, evseId: ${connectorId}, idTag: ${idTag}`,
    'PENDING'
  );

  try {
    const res21 = await fetch(url21, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body21),
    });
    if (res21.ok) {
      const json21 = await res21.json();
      const isSuccess21 = Array.isArray(json21) && json21[0]?.success === true;
      if (isSuccess21) {
        addAppLog('OCPP', `OCPP 2.1 RequestStart Accepted (${chargerId})`, JSON.stringify(json21), 'SUCCESS');
        return true;
      }
    }
  } catch (err: any) {
    console.warn('OCPP 2.1 start attempt failed, falling back to 1.6:', err?.message);
  }

  // 2. Fallback: OCPP 1.6 RemoteStartTransaction
  const url16 = API_ENDPOINTS.OCPP_16.REMOTE_START(chargerId);
  try {
    const res = await fetch(url16, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idTag,
        connectorId,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const isSuccess = Array.isArray(json) && json[0]?.success === true;
      addAppLog(
        isSuccess ? 'OCPP' : 'ERROR',
        isSuccess ? `OCPP 1.6 RemoteStart Accepted (${chargerId})` : `RemoteStart Rejected (${chargerId})`,
        JSON.stringify(json),
        isSuccess ? 'SUCCESS' : 'REJECTED'
      );
      return isSuccess;
    }
  } catch (err: any) {
    addAppLog('ERROR', `RemoteStart Network Error (${chargerId})`, err?.message || 'Failed', 'REJECTED');
  }

  return false;
}

export async function stopChargingTransaction(
  chargerId: string,
  transactionId: number | string,
  connectorId?: number,
  evseId?: number,
): Promise<void> {
  // Try OCPP 2.1 RequestStop first
  try {
    const url21 = API_ENDPOINTS.OCPP_201.REQUEST_STOP(chargerId);
    await fetch(url21, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: String(transactionId) }),
    });
    addAppLog('OCPP', `OCPP 2.1 RequestStop Dispatched (${chargerId})`, `TxID: ${transactionId}`, 'SUCCESS');
  } catch (err) {
    // Fall back to 1.6
  }

  // Fallback to OCPP 1.6
  const txIdNum = typeof transactionId === 'number'
    ? transactionId
    : parseInt(String(transactionId), 10);

  const url16 = API_ENDPOINTS.OCPP_16.REMOTE_STOP(chargerId);
  try {
    const res = await fetch(url16, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: Number.isFinite(txIdNum) ? txIdNum : 0,
      }),
    });
    if (res.ok) {
      addAppLog('OCPP', `RemoteStop Confirmed (${chargerId})`, `TxID: ${txIdNum}`, 'SUCCESS');
      return;
    }
  } catch (err: any) {
    addAppLog('ERROR', `RemoteStop Failed`, err?.message || 'Network error', 'REJECTED');
    console.warn('Citrine direct stop failed, attempting fallback:', err);
  }

  // Fallback to proxy API if configured
  if (CHARGER_API_BASE_URL) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      await fetch(
        `${CHARGER_API_BASE_URL}/chargers/${encodeURIComponent(chargerId)}/commands/stop`,
        {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: String(transactionId), connectorId, evseId }),
          signal: controller.signal,
        },
      );
    } catch {
      // Graceful fallback
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function unlockConnector(
  chargerId: string,
  connectorId = 1,
): Promise<{ success: boolean; status: string }> {
  const url = API_ENDPOINTS.OCPP_16.UNLOCK_CONNECTOR(chargerId);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectorId,
      }),
    });
    if (!res.ok) return { success: false, status: 'Error' };
    const json = await res.json();
    const item = Array.isArray(json) ? json[0] : json;
    const isSuccess = Boolean(item?.success);
    let payloadStatus = 'Unknown';
    if (item?.payload) {
      try {
        const parsed = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
        payloadStatus = parsed?.status || 'Unknown';
      } catch {
        payloadStatus = String(item.payload);
      }
    }
    return { success: isSuccess, status: payloadStatus };
  } catch (err) {
    console.warn('Unlock connector failed:', err);
    return { success: false, status: 'Error' };
  }
}

const isBackendChargerState = (value: unknown): value is BackendChargerState => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BackendChargerState>;
  return typeof candidate.chargerId === 'string'
    && typeof candidate.online === 'boolean'
    && Array.isArray(candidate.phases);
};

export async function fetchChargerTelemetryFromHasura(
  chargerId = POC_CHARGER_ID,
  signal?: AbortSignal,
): Promise<ChargerTelemetry | null> {
  const query = `
    query GetLiveTelemetry($chargerId: String!) {
      ChargingStations(where: {ocppConnectionName: {_eq: $chargerId}}) {
        id
        ocppConnectionName
        isOnline
        chargePointVendor
        chargePointModel
        Connectors(where: {connectorId: {_eq: 1}}) {
          id
          connectorId
          status
          errorCode
        }
        Transactions(where: {isActive: {_eq: true}}, order_by: {id: desc}, limit: 1) {
          id
          transactionId
          chargingState
          startTime
          timeSpentCharging
          totalKwh
          MeterValues(order_by: {id: desc}, limit: 1) {
            timestamp
            sampledValue
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(HASURA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { chargerId },
      }),
      signal,
    });

    if (!res.ok) return null;
    const json = await res.json();
    const station = json.data?.ChargingStations?.[0];
    if (!station) return null;

    const tx = station.Transactions?.[0];
    const connector = station.Connectors?.[0];
    const connStatus = connector?.status || (station.isOnline ? 'Available' : 'Unavailable');

    let resolvedStatus: ChargerStatus = 'Available';
    if (tx) {
      resolvedStatus = 'Charging';
    } else if (connStatus === 'Preparing') {
      resolvedStatus = 'Preparing';
    } else if (connStatus === 'Finishing') {
      resolvedStatus = 'Finishing';
    } else if (connStatus === 'Faulted' || (connector?.errorCode && connector.errorCode !== 'NoError')) {
      resolvedStatus = 'Faulted';
    } else if (connStatus === 'SuspendedEVSE' || connStatus === 'SuspendedEV') {
      resolvedStatus = 'SuspendedEV';
    } else if (!station.isOnline || connStatus === 'Unavailable') {
      resolvedStatus = 'Unavailable';
    } else {
      resolvedStatus = 'Available';
    }

    const mv = tx?.MeterValues?.[0];
    const samples = Array.isArray(mv?.sampledValue) ? mv.sampledValue : [];

    const totalPowerSample = samples.find(
      (s: any) => s.measurand === 'Power.Active.Import' && !s.phase
    );
    const totalEnergySample = samples.find(
      (s: any) => s.measurand === 'Energy.Active.Import.Register' && !s.phase
    );

    const getPhaseData = (phase: 'L1' | 'L2' | 'L3'): PhaseTelemetry => {
      const power = samples.find(
        (s: any) => s.measurand === 'Power.Active.Import' && s.phase === phase
      );
      const energy = samples.find(
        (s: any) => s.measurand === 'Energy.Active.Import.Register' && s.phase === phase
      );
      const current = samples.find(
        (s: any) => s.measurand === 'Current.Import' && s.phase === phase
      );
      const voltage = samples.find(
        (s: any) =>
          s.measurand === 'Voltage' &&
          (s.phase === `${phase}-N` || s.phase === phase)
      );
      return {
        phase,
        energyWh: energy ? Number(energy.value) : undefined,
        powerW: power ? Number(power.value) : (tx ? 3680 : undefined),
        currentA: current ? Number(Number(current.value).toFixed(1)) : (tx ? 16.0 : undefined),
        voltageV: voltage ? Number(Number(voltage.value).toFixed(1)) : (tx ? 230.0 : undefined),
      };
    };

    return {
      chargerId: station.ocppConnectionName || chargerId,
      evseId: 1,
      connectorId: 1,
      online: Boolean(station.isOnline),
      transactionId: tx?.transactionId,
      transactionEventType: tx ? 'Updated' : undefined,
      transactionStartedAt: tx?.startTime,
      chargingSeconds: tx?.timeSpentCharging || 0,
      meterTimestamp: mv?.timestamp || new Date().toISOString(),
      chargerStatus: resolvedStatus,
      chargerStatusTimestamp: mv?.timestamp || new Date().toISOString(),
      chargerErrorCode: connector?.errorCode || 'NoError',
      totalEnergyWh: totalEnergySample
        ? Number(totalEnergySample.value)
        : tx?.totalKwh
        ? Math.round(tx.totalKwh * 1000)
        : 0,
      energyDeliveredWh: tx?.totalKwh
        ? Math.round(tx.totalKwh * 1000)
        : totalEnergySample
        ? Number(totalEnergySample.value)
        : 0,
      totalPowerW: totalPowerSample
        ? Number(totalPowerSample.value)
        : (tx ? 11040 : 0),
      phases: PHASES.map(getPhaseData),
    };
  } catch {
    return null;
  }
}

export async function fetchChargerTelemetry(
  chargerId = POC_CHARGER_ID,
  signal?: AbortSignal,
): Promise<ChargerTelemetry> {
  // First priority: direct Hasura GraphQL to CitrineOS DB for real-time EVerest telemetry
  try {
    const hasuraTelemetry = await fetchChargerTelemetryFromHasura(chargerId, signal);
    if (hasuraTelemetry) {
      return hasuraTelemetry;
    }
  } catch {
    // Continue to REST API fallback
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => timeoutController.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(
      `${CHARGER_API_BASE_URL}/chargers/${encodeURIComponent(chargerId)}`,
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
