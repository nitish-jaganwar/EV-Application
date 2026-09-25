import type { BookingRepository } from './bookingTypes';
import { localBookingRepository } from './localBookingRepository';

// Replace this adapter with an API-backed repository when the booking server is ready.
export const bookingRepository: BookingRepository = localBookingRepository;
