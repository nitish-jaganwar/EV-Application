import type { Vehicle } from '@/context/VehicleContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BAYS, bayStatus, fits, type ParkingState } from '../parking/parkingRules';
import { parkingRepository } from '../parking/parkingRepository';

export default function ScanToChargeSheet({ visible, vehicle, onClose, onViewSlots }: {
  visible: boolean; vehicle: Vehicle | null; onClose: () => void; onViewSlots: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<ParkingState | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!visible) return;
    let active = true;
    const refresh = () => void parkingRepository.load().then(data => { if (active) { setState(data); setNow(Date.now()); } })
      .catch(() => { if (active) { setState(null); setMessage('Parking availability could not load.'); } });
    refresh(); const timer = setInterval(refresh, 15_000);
    return () => { active = false; clearInterval(timer); };
  }, [visible]);
  const close = () => { setScanning(false); setMessage(''); onClose(); };
  return <Modal visible={visible} animationType="slide" onRequestClose={close}><SafeAreaView style={s.root}>
    <View style={s.header}><Text style={s.title}>Scan to Charge</Text><Pressable accessibilityRole="button" accessibilityLabel="Close scanner" onPress={close} style={s.close}><Text>✕</Text></Pressable></View>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.body}>{vehicle?.name ?? 'Select a vehicle in Parking'} · Demo parking</Text>
      {scanning ? <CameraView style={{ height: 260 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => {
        setScanning(false); const code = data.trim().replace(/^tbits:\/\/charger\//i, '').toUpperCase();
        const bay = BAYS.find(b => b.id === code || b.chargerId === code);
        setMessage(bay ? `Charger ${bay.chargerId} belongs to ${bay.id}. Request energy in Parking to receive an allocation.` : 'This QR code does not match a charger in the demo parking.');
      }} /> : <Pressable accessibilityRole="button" style={s.button} onPress={async () => {
        try { const result = permission?.granted ? permission : await requestPermission();
          if (result.granted) setScanning(true); else setMessage('Allow camera access to scan, or open Parking below.');
        } catch { setMessage('Camera is unavailable. You can still open Parking.'); }
      }}><Text style={s.white}>Scan charger QR</Text></Pressable>}
      {message ? <Text accessibilityRole="alert" style={s.body}>{message}</Text> : null}
      <Text style={s.title}>Compatible parking bays</Text>
      <Text style={s.body}>Request the energy you need to see the best bay and estimated charging time.</Text>
      {state && vehicle ? BAYS.filter(b => fits(vehicle, b)).map(bay => <View style={s.row} key={bay.id}><Text style={s.body}>{bay.id} · {bay.connector}</Text><Text style={s.body}>{bayStatus(bay, state, now)}</Text></View>) : null}
    </ScrollView>
    <Pressable accessibilityRole="button" style={[s.button, { margin: 18 }]} onPress={() => { setScanning(false); onViewSlots(); }}><Text style={s.white}>Request energy & parking</Text></Pressable>
  </SafeAreaView></Modal>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: '#FFFFFF' }, header: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { padding: 14 }, content: { padding: 18, gap: 16 }, title: { fontSize: 19, fontWeight: '600', color: '#17233B' }, body: { fontSize: 14, lineHeight: 22, color: '#475569' },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  button: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center' }, white: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' } });
