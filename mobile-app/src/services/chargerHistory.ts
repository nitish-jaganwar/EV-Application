import { CHARGER_API_BASE_URL } from '@/services/chargerApi';
import type { ChargerTelemetry } from '@/services/citrineOsService';

export interface MeterPoint {
  timestamp: string;
  powerKw?: number;
  voltageV?: number;
  currentA?: number;
  energyKwh?: number;
}

interface RawEvent {
  origin?: string;
  message?: string;
  info?: { action?: string; timestamp?: string };
}

const finite = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};

const validTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const average = (values: number[]): number | undefined =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;

export function pointFromTelemetry(telemetry: ChargerTelemetry | null): MeterPoint | null {
  if (!telemetry || !validTimestamp(telemetry.meterTimestamp)) return null;
  const voltage = telemetry.phases.map((phase) => phase.voltageV).filter((v): v is number => v !== undefined);
  const current = telemetry.phases.map((phase) => phase.currentA).filter((v): v is number => v !== undefined);
  return {
    timestamp: telemetry.meterTimestamp,
    powerKw: telemetry.totalPowerW === undefined ? undefined : telemetry.totalPowerW / 1000,
    voltageV: average(voltage),
    currentA: average(current),
    energyKwh: telemetry.totalEnergyWh === undefined ? undefined : telemetry.totalEnergyWh / 1000,
  };
}

function pointFromMeterValue(value: unknown, fallbackTimestamp?: string): MeterPoint | null {
  if (!value || typeof value !== 'object') return null;
  const meter = value as { timestamp?: unknown; sampledValue?: unknown };
  const timestamp = validTimestamp(meter.timestamp) ? meter.timestamp : fallbackTimestamp;
  if (!validTimestamp(timestamp) || !Array.isArray(meter.sampledValue)) return null;

  let power: number | undefined;
  let energy: number | undefined;
  let aggregateVoltage: number | undefined;
  let aggregateCurrent: number | undefined;
  const phasePower = new Map<string, number>();
  const phaseEnergy = new Map<string, number>();
  const voltage = new Map<string, number>();
  const current = new Map<string, number>();
  for (const item of meter.sampledValue) {
    if (!item || typeof item !== 'object') continue;
    const sample = item as {
      measurand?: string; phase?: string; value?: unknown;
      unitOfMeasure?: { unit?: string; multiplier?: number };
      unit?: string;
    };
    const raw = finite(sample.value);
    if (raw === undefined) continue;
    const multiplier = finite(sample.unitOfMeasure?.multiplier) ?? 0;
    const unit = sample.unitOfMeasure?.unit ?? sample.unit;
    let reading = raw * Math.pow(10, multiplier);
    if (sample.measurand === 'Power.Active.Import' && unit === 'kW') reading *= 1000;
    if (sample.measurand === 'Energy.Active.Import.Register' && unit === 'kWh') reading *= 1000;
    const phase = sample.phase?.split('-')[0];
    switch (sample.measurand) {
      case 'Power.Active.Import':
        if (phase) phasePower.set(phase, reading);
        else power = reading;
        break;
      case 'Energy.Active.Import.Register':
        if (phase) phaseEnergy.set(phase, reading);
        else energy = reading;
        break;
      case 'Voltage':
        if (phase) voltage.set(phase, reading);
        else aggregateVoltage = reading;
        break;
      case 'Current.Import':
        if (phase) current.set(phase, reading);
        else aggregateCurrent = reading;
        break;
    }
  }
  const powerW = power ?? (phasePower.size ? [...phasePower.values()].reduce((a, b) => a + b, 0) : undefined);
  const energyWh = energy ?? (phaseEnergy.size ? [...phaseEnergy.values()].reduce((a, b) => a + b, 0) : undefined);
  const point: MeterPoint = {
    timestamp,
    powerKw: powerW === undefined ? undefined : powerW / 1000,
    energyKwh: energyWh === undefined ? undefined : energyWh / 1000,
    voltageV: average([...voltage.values()]) ?? aggregateVoltage,
    currentA: average([...current.values()]) ?? aggregateCurrent,
  };
  return [point.powerKw, point.energyKwh, point.voltageV, point.currentA].some((v) => v !== undefined)
    ? point : null;
}

export function mergeMeterPoints(points: MeterPoint[]): MeterPoint[] {
  const byTime = new Map<string, MeterPoint>();
  for (const point of points) {
    if (!validTimestamp(point.timestamp)) continue;
    const previous = byTime.get(point.timestamp);
    byTime.set(point.timestamp, {
      ...previous,
      ...Object.fromEntries(Object.entries(point).filter(([, value]) => value !== undefined)),
    } as MeterPoint);
  }
  return [...byTime.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).slice(-200);
}

export function parseMeterEvents(events: unknown): MeterPoint[] {
  if (!Array.isArray(events)) return [];
  const points: MeterPoint[] = [];
  for (const event of events as RawEvent[]) {
    if (event.origin !== 'cs' || typeof event.message !== 'string') continue;
    try {
      const frame: unknown = JSON.parse(event.message);
      if (!Array.isArray(frame) || frame[0] !== 2) continue;
      const action = frame[2];
      if (action !== 'TransactionEvent' && action !== 'MeterValues') continue;
      const payload = frame[3] as { meterValue?: unknown } | undefined;
      if (!Array.isArray(payload?.meterValue)) continue;
      for (const meter of payload.meterValue) {
        const point = pointFromMeterValue(meter, event.info?.timestamp);
        if (point) points.push(point);
      }
    } catch {
      // A malformed raw OCPP event should not hide the valid meter history.
    }
  }
  return mergeMeterPoints(points);
}

export async function fetchChargerHistory(chargerId: string, signal?: AbortSignal): Promise<MeterPoint[]> {
  const response = await fetch(
    `${CHARGER_API_BASE_URL}/chargers/${encodeURIComponent(chargerId)}/events`,
    { headers: { Accept: 'application/json' }, signal },
  );
  if (!response.ok) throw new Error(`Meter history returned HTTP ${response.status}`);
  return parseMeterEvents(await response.json());
}
