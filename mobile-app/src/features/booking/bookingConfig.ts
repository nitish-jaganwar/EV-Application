import type { BookingCharger } from './bookingTypes';

// Test-apartment settings. A future site API can supply this same shape.
export const BOOKING_CONFIG = {
  apartmentId: 'tower-a',
  apartmentName: 'Tower A',
  daysAhead: 7,
  opensAtHour: 6,
  closesAtHour: 23,
  timeStepMinutes: 15,
  durationOptionsMinutes: [30, 60, 90, 120, 150, 180, 210, 240] as const,
  chargers: [
    { id: 'C0', connectorType: 'Type 2', ratedPowerKw: 7.4 },
    { id: 'C1', connectorType: 'Type 2', ratedPowerKw: 7.4 },
    { id: 'C2', connectorType: '15A Socket', ratedPowerKw: 3.3 },
    { id: 'C3', connectorType: 'Type 2', ratedPowerKw: 7.4 },
  ] satisfies BookingCharger[],
} as const;
