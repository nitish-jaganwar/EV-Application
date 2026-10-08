import type { Vehicle } from '@/context/VehicleContext';

export type Bay = { id: string; chargerId: string; connector: Vehicle['connectorType']; powerKw: number; offline: boolean };
export type Occupancy = { bayId: string; expectedVacantAt: number; charging: boolean };
export type Allocation = {
  id: string; ownerId: string; vehicleId: string; vehicleName: string; bayId: string;
  energyKwh: number; powerKw: number; startsAt: number; endsAt: number;
  status: 'RESERVED' | 'PARKED' | 'COMPLETED' | 'CANCELLED';
};
export type ParkingState = { version: 1; occupied: Occupancy[]; allocations: Allocation[] };
export type Offer = { bayId: string; startsAt: number; endsAt: number; powerKw: number };

// Prototype site configuration. Replace with site/vehicle capabilities from the API.
export const PARKING_CONFIG = { name: 'Tower A · Basement', reminderMinutes: 5, horizonHours: 24, turnoverMinutes: 5 };
export const BAYS: Bay[] = Array.from({ length: 15 }, (_, i) => ({
  id: `P${String(i + 1).padStart(2, '0')}`, chargerId: `C${i + 1}`,
  connector: i >= 10 ? '15A Socket' : 'Type 2', powerKw: i >= 10 ? 3.3 : 7.4, offline: i === 8,
}));
export const isActive = (a: Allocation) => a.status === 'RESERVED' || a.status === 'PARKED';
export const fits = (vehicle: Vehicle, bay: Bay) => vehicle.connectorType === bay.connector
  || (vehicle.connectorType === 'CCS2' && bay.connector === 'Type 2');
export function validateEnergy(energy: number, vehicle: Vehicle): string | null {
  return !Number.isFinite(energy) || energy < 0.1 || energy > vehicle.batteryCapacityKwh
    ? `Enter 0.1–${vehicle.batteryCapacityKwh} kWh for this vehicle.` : null;
}
export function initialParking(now = Date.now()): ParkingState {
  return { version: 1, allocations: [], occupied: [
    { bayId: 'P02', expectedVacantAt: now + 25 * 60_000, charging: true },
    { bayId: 'P06', expectedVacantAt: now + 50 * 60_000, charging: true },
    { bayId: 'P12', expectedVacantAt: now + 10 * 60_000, charging: false },
    { bayId: 'P14', expectedVacantAt: now + 35 * 60_000, charging: true },
  ] };
}
export function bayStatus(bay: Bay, state: ParkingState, now: number): string {
  if (bay.offline) return 'Offline';
  const occupied = state.occupied.find(o => o.bayId === bay.id);
  if (occupied) return occupied.charging ? 'Charging' : 'Occupied';
  if (state.allocations.some(a => a.bayId === bay.id && a.status === 'PARKED')) return 'Occupied';
  if (state.allocations.some(a => a.bayId === bay.id && a.status === 'RESERVED' && a.startsAt <= now)) return 'Reserved';
  return 'Available';
}
export function isReady(a: Allocation, state: ParkingState, now: number): boolean {
  return a.status === 'RESERVED' && a.startsAt <= now && !BAYS.find(b => b.id === a.bayId)?.offline
    && !state.occupied.some(o => o.bayId === a.bayId)
    && !state.allocations.some(other => other.id !== a.id && other.bayId === a.bayId && isActive(other)
      && (other.status === 'PARKED' || other.startsAt <= a.startsAt));
}
export function recommend(state: ParkingState, vehicle: Vehicle, energy: number, now: number, excludeId?: string): Offer[] {
  if (validateEnergy(energy, vehicle)) return [];
  const horizon = now + PARKING_CONFIG.horizonHours * 3_600_000;
  return BAYS.filter(b => !b.offline && fits(vehicle, b)).flatMap(bay => {
    // Conservative demo charging rates; these are estimates, not measured vehicle capabilities.
    const powerKw = Math.min(bay.powerKw, vehicle.type === '2W' ? 1 : 7.2);
    const duration = Math.ceil(energy / powerKw * 60) * 60_000;
    const occupied = state.occupied.find(o => o.bayId === bay.id);
    let start = now;
    if (occupied) start = Math.max(start, occupied.expectedVacantAt > now ? occupied.expectedVacantAt : now + 15 * 60_000);
    const blocked = state.allocations.filter(a => a.id !== excludeId && a.bayId === bay.id && isActive(a))
      .map(a => ({ start: a.startsAt, end: Math.max(a.endsAt + PARKING_CONFIG.turnoverMinutes * 60_000, now + 15 * 60_000) }))
      .sort((a, b) => a.start - b.start);
    for (const block of blocked) {
      if (start < block.end && start + duration + PARKING_CONFIG.turnoverMinutes * 60_000 > block.start) start = block.end;
    }
    return start + duration <= horizon ? [{ bayId: bay.id, startsAt: start, endsAt: start + duration, powerKw }] : [];
  }).sort((a, b) => a.startsAt - b.startsAt || a.endsAt - b.endsAt || a.bayId.localeCompare(b.bayId));
}
export const timeLabel = (time: number) => new Date(time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export function durationLabel(start: number, end: number) {
  const mins = Math.ceil((end - start) / 60_000);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr${mins % 60 ? ` ${mins % 60} min` : ''}`;
}
