import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Vehicle } from '@/context/VehicleContext';
import { initialParking, isActive, isReady, recommend, type Allocation, type Offer, type ParkingState } from './parkingRules';

const KEY = 'tbits_parking_v1:tower-a';
const listeners = new Set<() => void>();
let queue: Promise<unknown> = Promise.resolve();
async function read(): Promise<ParkingState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) { const state = initialParking(); await AsyncStorage.setItem(KEY, JSON.stringify(state)); return state; }
  const state = JSON.parse(raw) as ParkingState;
  if (state.version !== 1 || !Array.isArray(state.occupied) || !Array.isArray(state.allocations)) throw new Error('Parking data could not load.');
  return state;
}
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work); queue = result.catch(() => undefined); return result;
}
async function save(state: ParkingState) {
  await AsyncStorage.setItem(KEY, JSON.stringify(state)); listeners.forEach(listener => listener());
}
export interface ParkingRepository {
  load(): Promise<ParkingState>;
  subscribe(listener: () => void): () => void;
  reserve(ownerId: string, vehicle: Vehicle, energy: number, offer: Offer, replaceId?: string): Promise<Allocation>;
  update(id: string, ownerId: string, action: 'CANCEL' | 'ARRIVE' | 'VACATE'): Promise<void>;
  demoBay(bayId: string, action: 'VACATE' | 'DELAY'): Promise<void>;
}
// Only this adapter accesses local storage. The real API must enforce ownership and conflicts in a DB transaction.
export const parkingRepository: ParkingRepository = {
  load: () => serial(read),
  subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  reserve(ownerId, vehicle, energy, offer, replaceId) {
    return serial(async () => {
      if (!ownerId) throw new Error('Please sign in before confirming parking.');
      const state = await read();
      const existing = state.allocations.find(a => a.id === replaceId && a.ownerId === ownerId && a.status === 'RESERVED');
      if (replaceId && !existing) throw new Error('This allocation can no longer be changed.');
      if (state.allocations.some(a => a.ownerId === ownerId && isActive(a) && a.id !== replaceId)) throw new Error('You already have an active parking allocation.');
      const now = Date.now();
      const fresh = recommend(state, vehicle, energy, now, replaceId).find(o => o.bayId === offer.bayId);
      // Small clock drift is safe; any changed parking window requires another review.
      if (!fresh || Math.abs(fresh.startsAt - offer.startsAt) > 60_000 || fresh.powerKw !== offer.powerKw) throw new Error('Availability changed. Please review the updated suggestions.');
      if (existing) existing.status = 'CANCELLED';
      const allocation: Allocation = { ...fresh, id: `parking:${now}:${Math.random().toString(36).slice(2, 8)}`,
        ownerId, vehicleId: vehicle.id, vehicleName: vehicle.name, energyKwh: energy, status: 'RESERVED' };
      state.allocations.push(allocation); await save(state); return allocation;
    });
  },
  update(id, ownerId, action) {
    return serial(async () => {
      const state = await read(); const allocation = state.allocations.find(a => a.id === id && a.ownerId === ownerId && isActive(a));
      if (!allocation) throw new Error('Allocation is no longer active.');
      if (action === 'ARRIVE') {
        if (!isReady(allocation, state, Date.now())) throw new Error('This bay is not ready yet.');
        allocation.status = 'PARKED';
      } else if (action === 'VACATE') {
        if (allocation.status !== 'PARKED') throw new Error('Only an occupied bay can be marked vacant.');
        allocation.status = 'COMPLETED';
      } else {
        if (allocation.status === 'PARKED') throw new Error('Remove your vehicle and mark the bay vacant first.');
        allocation.status = 'CANCELLED';
      }
      await save(state);
    });
  },
  demoBay(bayId, action) {
    return serial(async () => {
      const state = await read(); const occupied = state.occupied.find(o => o.bayId === bayId);
      if (!occupied) throw new Error('This bay has already been cleared.');
      if (action === 'VACATE') state.occupied = state.occupied.filter(o => o.bayId !== bayId);
      else occupied.expectedVacantAt = Math.max(Date.now(), occupied.expectedVacantAt) + 15 * 60_000;
      await save(state);
    });
  },
};
