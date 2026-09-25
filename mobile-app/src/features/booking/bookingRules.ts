import { BOOKING_CONFIG } from './bookingConfig';
import type { Booking, BookingCharger, ConnectorType } from './bookingTypes';

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function atLocalTime(day: string, minutesFromMidnight: number): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 0, minutesFromMidnight);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function isCompatible(vehicleConnector: ConnectorType, chargerConnector: ConnectorType): boolean {
  // CCS2 cars also use Type 2 AC. A 15A socket requires the matching vehicle charger.
  return vehicleConnector === chargerConnector || (vehicleConnector === 'CCS2' && chargerConnector === 'Type 2');
}

export function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return new Date(startA).getTime() < new Date(endB).getTime()
    && new Date(startB).getTime() < new Date(endA).getTime();
}

export function isSlotAvailable(chargerId: string, startsAt: string, endsAt: string, bookings: Booking[]): boolean {
  return !bookings.some((booking) => booking.status === 'CONFIRMED'
    && booking.chargerId === chargerId
    && overlaps(startsAt, endsAt, booking.startsAt, booking.endsAt));
}

export function dateOptions(today = new Date()): string[] {
  return Array.from({ length: BOOKING_CONFIG.daysAhead }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return dateKey(date);
  });
}

export function timeOptions(day: string, durationMinutes: number, now = new Date()): Date[] {
  const options: Date[] = [];
  for (let minute = BOOKING_CONFIG.opensAtHour * 60;
    minute + durationMinutes <= BOOKING_CONFIG.closesAtHour * 60;
    minute += BOOKING_CONFIG.timeStepMinutes) {
    const start = atLocalTime(day, minute);
    if (start.getTime() > now.getTime()) options.push(start);
  }
  return options;
}

export function nextWalkInStart(now = new Date()): Date | null {
  const day = dateKey(now);
  const minute = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil((minute + 1) / BOOKING_CONFIG.timeStepMinutes) * BOOKING_CONFIG.timeStepMinutes;
  if (rounded < BOOKING_CONFIG.opensAtHour * 60 || rounded >= BOOKING_CONFIG.closesAtHour * 60) return null;
  return atLocalTime(day, rounded);
}

export function alternatives(
  charger: BookingCharger,
  preferredStart: Date,
  durationMinutes: number,
  bookings: Booking[],
  now = new Date(),
): Date[] {
  const day = dateKey(preferredStart);
  const results: Date[] = [];
  const preferredMinute = preferredStart.getHours() * 60 + preferredStart.getMinutes();
  for (let minute = preferredMinute + BOOKING_CONFIG.timeStepMinutes;
    minute + durationMinutes <= BOOKING_CONFIG.closesAtHour * 60 && results.length < 3;
    minute += BOOKING_CONFIG.timeStepMinutes) {
    const start = atLocalTime(day, minute);
    if (start.getTime() <= now.getTime()) continue;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    if (isSlotAvailable(charger.id, start.toISOString(), end.toISOString(), bookings)) results.push(start);
  }
  return results;
}
