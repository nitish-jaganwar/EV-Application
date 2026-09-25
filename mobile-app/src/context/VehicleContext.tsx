import React, { createContext, useContext, useState } from 'react';

export interface Vehicle {
  id: string;
  name: string;
  brand: string;
  type: '2W' | '4W';
  plateNumber: string;
  batteryCapacityKwh: number;
  connectorType: '15A Socket' | 'Type 2' | 'CCS2';
  icon: string;
}

export const POPULAR_EVS: Omit<Vehicle, 'id' | 'plateNumber'>[] = [
  // 4-Wheelers
  { name: 'Tata Nexon EV', brand: 'Tata', type: '4W', batteryCapacityKwh: 40.5, connectorType: 'CCS2', icon: '🚗' },
  { name: 'Tata Punch EV', brand: 'Tata', type: '4W', batteryCapacityKwh: 35.0, connectorType: 'CCS2', icon: '🚗' },
  { name: 'Tata Tiago EV', brand: 'Tata', type: '4W', batteryCapacityKwh: 24.0, connectorType: 'Type 2', icon: '🚗' },
  { name: 'Tata Tigor EV', brand: 'Tata', type: '4W', batteryCapacityKwh: 26.0, connectorType: 'Type 2', icon: '🚗' },
  { name: 'MG ZS EV', brand: 'MG', type: '4W', batteryCapacityKwh: 50.3, connectorType: 'CCS2', icon: '🚗' },
  { name: 'Mahindra XUV400', brand: 'Mahindra', type: '4W', batteryCapacityKwh: 39.4, connectorType: 'CCS2', icon: '🚗' },
  // 2-Wheelers
  { name: 'Vida V1 Pro', brand: 'Hero Vida', type: '2W', batteryCapacityKwh: 3.94, connectorType: '15A Socket', icon: '🛵' },
  { name: 'Ather 450X', brand: 'Ather', type: '2W', batteryCapacityKwh: 3.7, connectorType: '15A Socket', icon: '🛵' },
  { name: 'Ola S1 Pro', brand: 'Ola', type: '2W', batteryCapacityKwh: 4.0, connectorType: '15A Socket', icon: '🛵' },
  { name: 'TVS iQube', brand: 'TVS', type: '2W', batteryCapacityKwh: 3.04, connectorType: '15A Socket', icon: '🛵' },
];

interface VehicleContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  selectVehicle: (id: string) => void;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
}

const DEFAULT_USER_VEHICLE: Vehicle = {
  id: 'veh-1',
  name: 'Vida V1 Pro',
  brand: 'Hero Vida',
  type: '2W',
  plateNumber: 'MP 04 74207',
  batteryCapacityKwh: 3.94,
  connectorType: '15A Socket',
  icon: '🛵',
};

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

export const VehicleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([DEFAULT_USER_VEHICLE]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(DEFAULT_USER_VEHICLE);

  const selectVehicle = (id: string) => {
    const v = vehicles.find((item) => item.id === id);
    if (v) setSelectedVehicle(v);
  };

  const addVehicle = (newVeh: Omit<Vehicle, 'id'>) => {
    const item: Vehicle = {
      ...newVeh,
      id: `veh-${Date.now()}`,
    };
    setVehicles((prev) => [...prev, item]);
    setSelectedVehicle(item);
  };

  return (
    <VehicleContext.Provider value={{ vehicles, selectedVehicle, selectVehicle, addVehicle }}>
      {children}
    </VehicleContext.Provider>
  );
};

export const useVehicle = () => {
  const context = useContext(VehicleContext);
  if (!context) {
    throw new Error('useVehicle must be used within a VehicleProvider');
  }
  return context;
};