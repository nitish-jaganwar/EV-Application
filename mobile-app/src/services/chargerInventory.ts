export type ChargerAvailability = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OFFLINE';

export interface ChargerItem {
  id: string;
  name: string;
  bayNumber: string;
  status: ChargerAvailability;
  powerKw: number;
  powerType: 'AC' | 'DC';
  connectorType: '15A Socket' | 'Type 2' | 'CCS2';
  walkInRatePerKwh: number;       // Higher immediate rate
  reservationRatePerKwh: number;  // Discounted planned rate
  currency: string;
  currentOccupantPlate?: string;
  estimatedAvailableTime?: string;
  notes?: string;
}

export const APARTMENT_CHARGERS: ChargerItem[] = [
  {
    id: 'cp001',
    name: 'Charger C1 (Fast AC)',
    bayNumber: 'Bay 01',
    status: 'AVAILABLE',
    powerKw: 7.4,
    powerType: 'AC',
    connectorType: 'Type 2',
    walkInRatePerKwh: 15,
    reservationRatePerKwh: 11,
    currency: '₹',
    notes: 'Primary resident charger with smart load balancing',
  },
  {
    id: 'cp002',
    name: 'Charger C2 (Fast AC)',
    bayNumber: 'Bay 02',
    status: 'OCCUPIED',
    powerKw: 7.4,
    powerType: 'AC',
    connectorType: 'Type 2',
    walkInRatePerKwh: 15,
    reservationRatePerKwh: 11,
    currency: '₹',
    currentOccupantPlate: 'MH 12 AB 4421',
    estimatedAvailableTime: '~25 min',
    notes: 'In use by Tata Nexon EV',
  },
  {
    id: 'cp003',
    name: 'Charger C3 (2-Wheeler Socket)',
    bayNumber: 'Bay 03 (2W)',
    status: 'AVAILABLE',
    powerKw: 3.3,
    powerType: 'AC',
    connectorType: '15A Socket',
    walkInRatePerKwh: 12,
    reservationRatePerKwh: 9,
    currency: '₹',
    notes: 'Optimized for Ather, Ola, Vida & TVS iQube',
  },
  {
    id: 'cp004',
    name: 'Charger C4 (2-Wheeler Socket)',
    bayNumber: 'Bay 04 (2W)',
    status: 'AVAILABLE',
    powerKw: 3.3,
    powerType: 'AC',
    connectorType: '15A Socket',
    walkInRatePerKwh: 12,
    reservationRatePerKwh: 9,
    currency: '₹',
    notes: 'Dedicated 2-wheeler charging bay',
  },
  {
    id: 'cp005',
    name: 'Charger C5 (DC Super Fast)',
    bayNumber: 'Bay 05',
    status: 'AVAILABLE',
    powerKw: 22.0,
    powerType: 'DC',
    connectorType: 'CCS2',
    walkInRatePerKwh: 18,
    reservationRatePerKwh: 14,
    currency: '₹',
    notes: 'High-speed fast charging for 4-wheelers',
  },
  {
    id: 'cp006',
    name: 'Charger C6 (Fast AC)',
    bayNumber: 'Bay 06',
    status: 'RESERVED',
    powerKw: 7.4,
    powerType: 'AC',
    connectorType: 'Type 2',
    walkInRatePerKwh: 15,
    reservationRatePerKwh: 11,
    currency: '₹',
    estimatedAvailableTime: 'Slot at 4:30 PM',
    notes: 'Pre-booked by resident',
  },
];
