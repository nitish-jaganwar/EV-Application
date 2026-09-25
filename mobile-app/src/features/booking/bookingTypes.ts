import type { Vehicle } from '@/context/VehicleContext';

export type ConnectorType = Vehicle['connectorType'];

export interface BookingCharger {
  id: string;
  connectorType: ConnectorType;
  ratedPowerKw: number;
}

export interface Booking {
  id: string;
  apartmentId: string;
  chargerId: string;
  vehicleId: string;
  vehicleConnectorType: ConnectorType;
  ownerId: string;
  startsAt: string;
  endsAt: string;
  status: 'CONFIRMED' | 'CANCELLED';
}

export type BookingRequest = Omit<Booking, 'id' | 'status'>;

// The server implementation must re-check conflicts and eligibility atomically.
export interface BookingRepository {
  list(dateKey: string): Promise<Booking[]>;
  listForOwner(ownerId: string): Promise<Booking[]>;
  reserve(request: BookingRequest): Promise<Booking>;
  cancel(bookingId: string, ownerId: string): Promise<void>;
}
