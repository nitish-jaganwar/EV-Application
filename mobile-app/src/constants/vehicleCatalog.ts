export interface VehicleVariant {
  id: string;
  name: string;
  variantName: string;
  brand: string;
  type: '2W' | '4W';
  batteryCapacityKwh: number;
  connectorType: '15A Socket' | 'Type 2' | 'CCS2';
  icon: string;
}

export interface VehicleModelGroup {
  id: string;
  modelName: string;
  brand: string;
  type: '2W' | '4W';
  icon: string;
  variants: VehicleVariant[];
}

export const VEHICLE_CATALOG: VehicleModelGroup[] = [
  // 4-Wheelers: Tata Motors (Matches Screenshot 2)
  {
    id: 'tata-curvv-ev',
    modelName: 'Curvv EV',
    brand: 'Tata',
    type: '4W',
    icon: '🚗',
    variants: [
      { id: 'curvv-creative-45', name: 'Curvv EV Creative 45', variantName: 'Creative 45', brand: 'Tata', type: '4W', batteryCapacityKwh: 45.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'curvv-accomplished-45', name: 'Curvv EV Accomplished 45', variantName: 'Accomplished 45', brand: 'Tata', type: '4W', batteryCapacityKwh: 45.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'curvv-empowered-45', name: 'Curvv EV Empowered Plus 45', variantName: 'Empowered Plus 45', brand: 'Tata', type: '4W', batteryCapacityKwh: 45.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'curvv-empowered-55', name: 'Curvv EV Empowered Plus A 55', variantName: 'Empowered Plus A 55', brand: 'Tata', type: '4W', batteryCapacityKwh: 55.0, connectorType: 'CCS2', icon: '🚗' },
    ],
  },
  {
    id: 'tata-harrier-ev',
    modelName: 'Harrier EV',
    brand: 'Tata',
    type: '4W',
    icon: '🚙',
    variants: [
      { id: 'harrier-adventure', name: 'Harrier EV Adventure', variantName: 'Adventure 60', brand: 'Tata', type: '4W', batteryCapacityKwh: 60.0, connectorType: 'CCS2', icon: '🚙' },
      { id: 'harrier-fearless', name: 'Harrier EV Fearless AWD', variantName: 'Fearless AWD 75', brand: 'Tata', type: '4W', batteryCapacityKwh: 75.0, connectorType: 'CCS2', icon: '🚙' },
      { id: 'harrier-empowered', name: 'Harrier EV Empowered Plus', variantName: 'Empowered Plus 75', brand: 'Tata', type: '4W', batteryCapacityKwh: 75.0, connectorType: 'CCS2', icon: '🚙' },
      { id: 'harrier-dark', name: 'Harrier EV Dark Edition', variantName: 'Dark Edition 75', brand: 'Tata', type: '4W', batteryCapacityKwh: 75.0, connectorType: 'CCS2', icon: '🚙' },
    ],
  },
  {
    id: 'tata-nexon-ev',
    modelName: 'Nexon EV',
    brand: 'Tata',
    type: '4W',
    icon: '🚗',
    variants: [
      { id: 'nexon-creative-45', name: 'Nexon EV Creative 45', variantName: 'Creative 45', brand: 'Tata', type: '4W', batteryCapacityKwh: 45.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-creative-plus-mr', name: 'Nexon EV Creative Plus MR', variantName: 'Creative Plus MR', brand: 'Tata', type: '4W', batteryCapacityKwh: 30.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-empowered-45', name: 'Nexon EV Empowered 45', variantName: 'Empowered 45', brand: 'Tata', type: '4W', batteryCapacityKwh: 45.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-empowered-plus-a-45', name: 'Nexon EV Empowered Plus A 45', variantName: 'Empowered Plus A 45', brand: 'Tata', type: '4W', batteryCapacityKwh: 45.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-empowered-plus-a-45-dark', name: 'Nexon EV Empowered Plus A 45 Dark', variantName: 'Empowered Plus A 45 Dark', brand: 'Tata', type: '4W', batteryCapacityKwh: 45.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-empowered-plus-a-45-red-dark', name: 'Nexon EV Empowered Plus A 45 Red Dark', variantName: 'Empowered Plus A 45 Red Dark', brand: 'Tata', type: '4W', batteryCapacityKwh: 45.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-fearless-45', name: 'Nexon EV Fearless 45', variantName: 'Fearless 45', brand: 'Tata', type: '4W', batteryCapacityKwh: 45.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-fearless-plus-mr', name: 'Nexon EV Fearless Plus MR', variantName: 'Fearless Plus MR', brand: 'Tata', type: '4W', batteryCapacityKwh: 30.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-xm', name: 'Nexon EV XM', variantName: 'XM (30.2 kWh)', brand: 'Tata', type: '4W', batteryCapacityKwh: 30.2, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-xz-plus', name: 'Nexon EV XZ Plus', variantName: 'XZ Plus (30.2 kWh)', brand: 'Tata', type: '4W', batteryCapacityKwh: 30.2, connectorType: 'CCS2', icon: '🚗' },
      { id: 'nexon-xz-plus-lux', name: 'Nexon EV XZ Plus LUX', variantName: 'XZ Plus LUX (40.5 kWh)', brand: 'Tata', type: '4W', batteryCapacityKwh: 40.5, connectorType: 'CCS2', icon: '🚗' },
    ],
  },
  {
    id: 'tata-punch-ev',
    modelName: 'Punch EV',
    brand: 'Tata',
    type: '4W',
    icon: '🚗',
    variants: [
      { id: 'punch-smart', name: 'Punch EV Smart 25', variantName: 'Smart 25', brand: 'Tata', type: '4W', batteryCapacityKwh: 25.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'punch-smart-plus', name: 'Punch EV Smart Plus 25', variantName: 'Smart Plus 25', brand: 'Tata', type: '4W', batteryCapacityKwh: 25.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'punch-adventure', name: 'Punch EV Adventure 25', variantName: 'Adventure 25', brand: 'Tata', type: '4W', batteryCapacityKwh: 25.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'punch-empowered-35', name: 'Punch EV Empowered 35', variantName: 'Empowered 35 (LR)', brand: 'Tata', type: '4W', batteryCapacityKwh: 35.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'punch-empowered-plus-35', name: 'Punch EV Empowered Plus S 35', variantName: 'Empowered Plus S 35', brand: 'Tata', type: '4W', batteryCapacityKwh: 35.0, connectorType: 'CCS2', icon: '🚗' },
    ],
  },
  {
    id: 'tata-tiago-ev',
    modelName: 'Tiago EV',
    brand: 'Tata',
    type: '4W',
    icon: '🚗',
    variants: [
      { id: 'tiago-xe', name: 'Tiago EV XE 19.2', variantName: 'XE (19.2 kWh)', brand: 'Tata', type: '4W', batteryCapacityKwh: 19.2, connectorType: 'Type 2', icon: '🚗' },
      { id: 'tiago-xt', name: 'Tiago EV XT 19.2', variantName: 'XT (19.2 kWh)', brand: 'Tata', type: '4W', batteryCapacityKwh: 19.2, connectorType: 'Type 2', icon: '🚗' },
      { id: 'tiago-xz-plus', name: 'Tiago EV XZ Plus 24', variantName: 'XZ Plus (24 kWh)', brand: 'Tata', type: '4W', batteryCapacityKwh: 24.0, connectorType: 'Type 2', icon: '🚗' },
      { id: 'tiago-xz-plus-tech-lux', name: 'Tiago EV XZ Plus Tech LUX 24', variantName: 'XZ Plus Tech LUX (24 kWh)', brand: 'Tata', type: '4W', batteryCapacityKwh: 24.0, connectorType: 'Type 2', icon: '🚗' },
    ],
  },
  {
    id: 'tata-sierra-ev',
    modelName: 'Sierra EV',
    brand: 'Tata',
    type: '4W',
    icon: '🚙',
    variants: [
      { id: 'sierra-creative', name: 'Sierra EV Creative', variantName: 'Creative 55', brand: 'Tata', type: '4W', batteryCapacityKwh: 55.0, connectorType: 'CCS2', icon: '🚙' },
      { id: 'sierra-accomplished', name: 'Sierra EV Accomplished', variantName: 'Accomplished 65', brand: 'Tata', type: '4W', batteryCapacityKwh: 65.0, connectorType: 'CCS2', icon: '🚙' },
      { id: 'sierra-empowered', name: 'Sierra EV Empowered', variantName: 'Empowered AWD', brand: 'Tata', type: '4W', batteryCapacityKwh: 65.0, connectorType: 'CCS2', icon: '🚙' },
    ],
  },
  // 4-Wheelers: MG Motors
  {
    id: 'mg-windsor-ev',
    modelName: 'Windsor EV',
    brand: 'MG',
    type: '4W',
    icon: '🚗',
    variants: [
      { id: 'windsor-excite', name: 'MG Windsor EV Excite', variantName: 'Excite 38', brand: 'MG', type: '4W', batteryCapacityKwh: 38.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'windsor-exclusive', name: 'MG Windsor EV Exclusive', variantName: 'Exclusive 38', brand: 'MG', type: '4W', batteryCapacityKwh: 38.0, connectorType: 'CCS2', icon: '🚗' },
      { id: 'windsor-essence', name: 'MG Windsor EV Essence', variantName: 'Essence 38', brand: 'MG', type: '4W', batteryCapacityKwh: 38.0, connectorType: 'CCS2', icon: '🚗' },
    ],
  },
  {
    id: 'mg-zs-ev',
    modelName: 'ZS EV',
    brand: 'MG',
    type: '4W',
    icon: '🚗',
    variants: [
      { id: 'zs-executive', name: 'MG ZS EV Executive', variantName: 'Executive 50.3', brand: 'MG', type: '4W', batteryCapacityKwh: 50.3, connectorType: 'CCS2', icon: '🚗' },
      { id: 'zs-excite', name: 'MG ZS EV Excite', variantName: 'Excite 50.3', brand: 'MG', type: '4W', batteryCapacityKwh: 50.3, connectorType: 'CCS2', icon: '🚗' },
      { id: 'zs-exclusive-plus', name: 'MG ZS EV Exclusive Plus', variantName: 'Exclusive Plus 50.3', brand: 'MG', type: '4W', batteryCapacityKwh: 50.3, connectorType: 'CCS2', icon: '🚗' },
      { id: 'zs-essence', name: 'MG ZS EV Essence', variantName: 'Essence 50.3', brand: 'MG', type: '4W', batteryCapacityKwh: 50.3, connectorType: 'CCS2', icon: '🚗' },
    ],
  },
  {
    id: 'mg-comet-ev',
    modelName: 'Comet EV',
    brand: 'MG',
    type: '4W',
    icon: '🚙',
    variants: [
      { id: 'comet-pace', name: 'MG Comet EV Pace', variantName: 'Pace 17.3', brand: 'MG', type: '4W', batteryCapacityKwh: 17.3, connectorType: 'Type 2', icon: '🚙' },
      { id: 'comet-play', name: 'MG Comet EV Play', variantName: 'Play 17.3', brand: 'MG', type: '4W', batteryCapacityKwh: 17.3, connectorType: 'Type 2', icon: '🚙' },
      { id: 'comet-plush', name: 'MG Comet EV Plush', variantName: 'Plush Fast-Charge 17.3', brand: 'MG', type: '4W', batteryCapacityKwh: 17.3, connectorType: 'Type 2', icon: '🚙' },
    ],
  },
  // 4-Wheelers: Mahindra
  {
    id: 'mahindra-xuv400',
    modelName: 'XUV400 EV',
    brand: 'Mahindra',
    type: '4W',
    icon: '🚗',
    variants: [
      { id: 'xuv400-ec-pro', name: 'Mahindra XUV400 EC Pro', variantName: 'EC Pro 34.5', brand: 'Mahindra', type: '4W', batteryCapacityKwh: 34.5, connectorType: 'CCS2', icon: '🚗' },
      { id: 'xuv400-el-pro', name: 'Mahindra XUV400 EL Pro', variantName: 'EL Pro 39.4', brand: 'Mahindra', type: '4W', batteryCapacityKwh: 39.4, connectorType: 'CCS2', icon: '🚗' },
    ],
  },
  {
    id: 'mahindra-be-6e',
    modelName: 'BE 6e',
    brand: 'Mahindra',
    type: '4W',
    icon: '🚙',
    variants: [
      { id: 'be6e-pack-one', name: 'Mahindra BE 6e Pack ONE', variantName: 'Pack ONE 59 kWh', brand: 'Mahindra', type: '4W', batteryCapacityKwh: 59.0, connectorType: 'CCS2', icon: '🚙' },
      { id: 'be6e-pack-two', name: 'Mahindra BE 6e Pack TWO', variantName: 'Pack TWO 79 kWh', brand: 'Mahindra', type: '4W', batteryCapacityKwh: 79.0, connectorType: 'CCS2', icon: '🚙' },
    ],
  },
  // 2-Wheelers: Ather, Ola, TVS, Vida, Bajaj
  {
    id: 'ather-450x',
    modelName: 'Ather 450X',
    brand: 'Ather',
    type: '2W',
    icon: '🛵',
    variants: [
      { id: 'ather-450x-29', name: 'Ather 450X (2.9 kWh)', variantName: '2.9 kWh Gen 3', brand: 'Ather', type: '2W', batteryCapacityKwh: 2.9, connectorType: '15A Socket', icon: '🛵' },
      { id: 'ather-450x-37', name: 'Ather 450X (3.7 kWh)', variantName: '3.7 kWh Gen 3 Pro', brand: 'Ather', type: '2W', batteryCapacityKwh: 3.7, connectorType: '15A Socket', icon: '🛵' },
    ],
  },
  {
    id: 'ather-rizta',
    modelName: 'Ather Rizta',
    brand: 'Ather',
    type: '2W',
    icon: '🛵',
    variants: [
      { id: 'rizta-s', name: 'Ather Rizta S (2.9 kWh)', variantName: 'S (2.9 kWh)', brand: 'Ather', type: '2W', batteryCapacityKwh: 2.9, connectorType: '15A Socket', icon: '🛵' },
      { id: 'rizta-z-29', name: 'Ather Rizta Z (2.9 kWh)', variantName: 'Z (2.9 kWh)', brand: 'Ather', type: '2W', batteryCapacityKwh: 2.9, connectorType: '15A Socket', icon: '🛵' },
      { id: 'rizta-z-37', name: 'Ather Rizta Z (3.7 kWh)', variantName: 'Z (3.7 kWh)', brand: 'Ather', type: '2W', batteryCapacityKwh: 3.7, connectorType: '15A Socket', icon: '🛵' },
    ],
  },
  {
    id: 'ola-s1-pro',
    modelName: 'Ola S1 Pro',
    brand: 'Ola',
    type: '2W',
    icon: '🛵',
    variants: [
      { id: 'ola-s1-pro-gen2', name: 'Ola S1 Pro Gen 2', variantName: 'Gen 2 (4.0 kWh)', brand: 'Ola', type: '2W', batteryCapacityKwh: 4.0, connectorType: '15A Socket', icon: '🛵' },
      { id: 'ola-s1-pro-gen1', name: 'Ola S1 Pro Gen 1', variantName: 'Gen 1 (3.97 kWh)', brand: 'Ola', type: '2W', batteryCapacityKwh: 3.97, connectorType: '15A Socket', icon: '🛵' },
    ],
  },
  {
    id: 'ola-s1-air',
    modelName: 'Ola S1 Air',
    brand: 'Ola',
    type: '2W',
    icon: '🛵',
    variants: [
      { id: 'ola-s1-air-3', name: 'Ola S1 Air (3.0 kWh)', variantName: 'Standard (3.0 kWh)', brand: 'Ola', type: '2W', batteryCapacityKwh: 3.0, connectorType: '15A Socket', icon: '🛵' },
    ],
  },
  {
    id: 'hero-vida-v1',
    modelName: 'Vida V1',
    brand: 'Hero Vida',
    type: '2W',
    icon: '🛵',
    variants: [
      { id: 'vida-v1-pro', name: 'Hero Vida V1 Pro', variantName: 'V1 Pro (3.94 kWh)', brand: 'Hero Vida', type: '2W', batteryCapacityKwh: 3.94, connectorType: '15A Socket', icon: '🛵' },
      { id: 'vida-v1-plus', name: 'Hero Vida V1 Plus', variantName: 'V1 Plus (3.44 kWh)', brand: 'Hero Vida', type: '2W', batteryCapacityKwh: 3.44, connectorType: '15A Socket', icon: '🛵' },
    ],
  },
  {
    id: 'tvs-iqube',
    modelName: 'TVS iQube',
    brand: 'TVS',
    type: '2W',
    icon: '🛵',
    variants: [
      { id: 'tvs-iqube-std', name: 'TVS iQube Standard', variantName: 'Standard (3.4 kWh)', brand: 'TVS', type: '2W', batteryCapacityKwh: 3.4, connectorType: '15A Socket', icon: '🛵' },
      { id: 'tvs-iqube-st', name: 'TVS iQube ST', variantName: 'ST (5.1 kWh)', brand: 'TVS', type: '2W', batteryCapacityKwh: 5.1, connectorType: '15A Socket', icon: '🛵' },
      { id: 'tvs-iqube-22', name: 'TVS iQube (2.2 kWh)', variantName: 'Base (2.2 kWh)', brand: 'TVS', type: '2W', batteryCapacityKwh: 2.2, connectorType: '15A Socket', icon: '🛵' },
    ],
  },
  {
    id: 'bajaj-chetak',
    modelName: 'Bajaj Chetak',
    brand: 'Bajaj',
    type: '2W',
    icon: '🛵',
    variants: [
      { id: 'chetak-2901', name: 'Bajaj Chetak 2901', variantName: '2901 (2.88 kWh)', brand: 'Bajaj', type: '2W', batteryCapacityKwh: 2.88, connectorType: '15A Socket', icon: '🛵' },
      { id: 'chetak-3201', name: 'Bajaj Chetak 3201', variantName: '3201 Special (3.2 kWh)', brand: 'Bajaj', type: '2W', batteryCapacityKwh: 3.2, connectorType: '15A Socket', icon: '🛵' },
    ],
  },
];
