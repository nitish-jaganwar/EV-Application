import AsyncStorage from '@react-native-async-storage/async-storage';
import { BOOKING_CONFIG } from './bookingConfig';
import { atLocalTime, dateKey, dateOptions, isCompatible, isSlotAvailable, overlaps } from './bookingRules';
import type { Booking, BookingRepository, BookingRequest } from './bookingTypes';

const STORAGE_KEY = `tbits_demo_bookings_v1:${BOOKING_CONFIG.apartmentId}`;

// These occupied windows make the prototype's alternative-slot flow testable.
// They are sample bookings, never live charger or resident data.
const DEMO_OCCUPIED = [
  { chargerId: 'C0', startMinute: 10 * 60, endMinute: 11 * 60 },
  { chargerId: 'C1', startMinute: 10 * 60 + 30, endMinute: 11 * 60 + 30 },
  { chargerId: 'C2', startMinute: 18 * 60, endMinute: 19 * 60 },
] as const;

function sampleBookings(day: string): Booking[] {
  return DEMO_OCCUPIED.map((block) => ({
    id: `sample:${day}:${block.chargerId}`,
    apartmentId: BOOKING_CONFIG.apartmentId,
    chargerId: block.chargerId,
    vehicleId: 'sample',
    vehicleConnectorType: 'Type 2',
    ownerId: 'sample',
    startsAt: atLocalTime(day, block.startMinute).toISOString(),
    endsAt: atLocalTime(day, block.endMinute).toISOString(),
    status: 'CONFIRMED',
  }));
}

async function readSaved(): Promise<Booking[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Saved demo bookings are invalid.');
  return parsed as Booking[];
}

// A single serialized queue prevents two actions in this app instance from racing.
// A real multi-device backend must enforce the same conflict rule transactionally.
let pending: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const result = pending.then(action);
  pending = result.catch(() => undefined);
  return result;
}

export const localBookingRepository: BookingRepository = {
  async list(day) {
    const saved = await readSaved();
    return [...sampleBookings(day), ...saved.filter((booking) =>
      booking.status === 'CONFIRMED' && dateKey(new Date(booking.startsAt)) === day)];
  },

  async listForOwner(ownerId) {
    const saved = await readSaved();
    return saved.filter((booking) => booking.ownerId === ownerId)
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  },

  reserve(request) {
    return serial(async () => {
      const start = new Date(request.startsAt);
      const end = new Date(request.endsAt);
      const day = dateKey(start);
      const charger = BOOKING_CONFIG.chargers.find((item) => item.id === request.chargerId);
      if (request.apartmentId !== BOOKING_CONFIG.apartmentId || !charger) throw new Error('Charger is not in this apartment.');
      if (!isCompatible(request.vehicleConnectorType, charger.connectorType)) throw new Error('This charger does not match your vehicle.');
      if (!dateOptions().includes(day) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())
        || start.getTime() <= Date.now() || end.getTime() <= start.getTime()
        || dateKey(end) !== day || start.getHours() * 60 + start.getMinutes() < BOOKING_CONFIG.opensAtHour * 60
        || end.getHours() * 60 + end.getMinutes() > BOOKING_CONFIG.closesAtHour * 60) {
        throw new Error('Choose a future slot within the apartment booking hours.');
      }
      const durationMinutes = (end.getTime() - start.getTime()) / 60_000;
      if (!BOOKING_CONFIG.durationOptionsMinutes.some((minutes) => minutes === durationMinutes)) {
        throw new Error('Choose one of the available slot durations.');
      }
      const saved = await readSaved();
      const dayBookings = [...sampleBookings(day), ...saved.filter((booking) => booking.status === 'CONFIRMED')];
      if (!isSlotAvailable(request.chargerId, request.startsAt, request.endsAt, dayBookings)) {
        throw new Error('This slot was just taken. Please choose another time.');
      }
      if (dayBookings.some((booking) => booking.ownerId === request.ownerId
        && overlaps(request.startsAt, request.endsAt, booking.startsAt, booking.endsAt))) {
        throw new Error('You already have another booking during this time.');
      }
      const booking: Booking = {
        ...request,
        id: `booking:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        status: 'CONFIRMED',
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...saved, booking]));
      return booking;
    });
  },

  cancel(bookingId, ownerId) {
    return serial(async () => {
      const saved = await readSaved();
      const index = saved.findIndex((booking) => booking.id === bookingId
        && booking.ownerId === ownerId && booking.status === 'CONFIRMED');
      if (index < 0) throw new Error('Booking is no longer available to cancel.');
      const updated = [...saved];
      updated[index] = { ...updated[index], status: 'CANCELLED' };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    });
  },
};

