export interface TimeSlot {
  id: string;
  startTime: string; // "10:00"
  endTime: string;   // "11:30"
  status: 'AVAILABLE' | 'BOOKED' | 'MY_BOOKING';
  bookedByVehicle?: string;
}

export interface Charger {
  id: string; // "C0", "C1", etc.
  phase: 'R' | 'G' | 'B';
  connectorType: 'Type 2' | '15A Socket' | 'CCS2';
  powerKw: number;
  slots: TimeSlot[];
}

// Mock database: 9 Apartment parking chargers (C0 to C8)
export const MOCK_CHARGERS: Charger[] = [
  {
    id: 'C0',
    phase: 'R',
    connectorType: 'Type 2',
    powerKw: 7.4,
    slots: [
      { id: 'c0-1', startTime: '06:00', endTime: '10:00', status: 'BOOKED', bookedByVehicle: 'C13' },
      { id: 'c0-2', startTime: '10:15', endTime: '11:30', status: 'AVAILABLE' },
      { id: 'c0-3', startTime: '12:00', endTime: '13:00', status: 'AVAILABLE' },
      { id: 'c0-4', startTime: '13:00', endTime: '17:30', status: 'BOOKED', bookedByVehicle: 'C22' },
    ],
  },
  {
    id: 'C1',
    phase: 'R',
    connectorType: 'Type 2',
    powerKw: 7.4,
    slots: [
      { id: 'c1-1', startTime: '06:00', endTime: '10:30', status: 'BOOKED', bookedByVehicle: 'S16' },
      { id: 'c1-2', startTime: '10:30', endTime: '12:00', status: 'AVAILABLE' },
      { id: 'c1-3', startTime: '12:00', endTime: '15:00', status: 'AVAILABLE' },
    ],
  },
  {
    id: 'C2',
    phase: 'R',
    connectorType: '15A Socket',
    powerKw: 3.3,
    slots: [
      { id: 'c2-1', startTime: '08:00', endTime: '10:00', status: 'AVAILABLE' },
      { id: 'c2-2', startTime: '10:00', endTime: '14:30', status: 'BOOKED', bookedByVehicle: 'C24' },
      { id: 'c2-3', startTime: '14:30', endTime: '16:00', status: 'AVAILABLE' },
    ],
  },
  {
    id: 'C3',
    phase: 'G',
    connectorType: 'Type 2',
    powerKw: 7.4,
    slots: [
      { id: 'c3-1', startTime: '09:00', endTime: '11:00', status: 'AVAILABLE' },
      { id: 'c3-2', startTime: '11:15', endTime: '12:30', status: 'AVAILABLE' },
      { id: 'c3-3', startTime: '12:30', endTime: '16:45', status: 'BOOKED', bookedByVehicle: 'C6' },
    ],
  },
  {
    id: 'C6',
    phase: 'B',
    connectorType: 'Type 2',
    powerKw: 7.4,
    slots: [
      { id: 'c6-1', startTime: '06:00', endTime: '10:00', status: 'BOOKED', bookedByVehicle: 'C7' },
      { id: 'c6-2', startTime: '10:00', endTime: '11:15', status: 'AVAILABLE' },
      { id: 'c6-3', startTime: '11:15', endTime: '12:00', status: 'AVAILABLE' },
    ],
  },
  {
    id: 'C7',
    phase: 'B',
    connectorType: 'Type 2',
    powerKw: 7.4,
    slots: [
      { id: 'c7-1', startTime: '09:30', endTime: '10:30', status: 'BOOKED', bookedByVehicle: 'B23' },
      { id: 'c7-2', startTime: '10:30', endTime: '14:45', status: 'AVAILABLE' },
    ],
  },
];