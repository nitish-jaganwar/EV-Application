import type { Vehicle } from '@/context/VehicleContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOOKING_CONFIG } from './bookingConfig';
import { bookingRepository } from './bookingRepository';
import { dateKey, formatTime, isCompatible, isSlotAvailable, nextWalkInStart, timeOptions } from './bookingRules';
import type { Booking } from './bookingTypes';

interface Props {
  visible: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onViewSlots: () => void;
}

function chargerFromCode(raw: string): string | null {
  const code = raw.trim();
  if (BOOKING_CONFIG.chargers.some((charger) => charger.id === code)) return code;
  const match = /^tbits:\/\/charger\/(C[0-9]+)$/i.exec(code);
  const id = match?.[1]?.toUpperCase();
  return BOOKING_CONFIG.chargers.some((charger) => charger.id === id) ? id! : null;
}

export default function ScanToChargeSheet({ visible, vehicle, onClose, onViewSlots }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!visible) return;
    const refresh = () => {
      const next = new Date();
      setNow(next);
      void bookingRepository.list(dateKey(next)).then(setBookings).catch(() => setMessage('Demo slot list is unavailable.'));
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [visible]);

  async function startScan() {
    try {
      const granted = permission?.granted ? permission : await requestPermission();
      if (granted.granted) { setMessage(''); setScanning(true); }
      else setMessage('Camera access is needed to scan a charger QR code. You can still view slots below.');
    } catch {
      setMessage('Camera could not open. You can still view slots below.');
    }
  }

  const nextStart = nextWalkInStart(now);
  const choices = timeOptions(dateKey(now), 60, now).filter((choice) => !nextStart || choice >= nextStart);
  const rows = BOOKING_CONFIG.chargers.filter((charger) => vehicle && isCompatible(vehicle.connectorType, charger.connectorType))
    .map((charger) => ({
      charger,
      next: choices.find((start) => isSlotAvailable(charger.id, start.toISOString(), new Date(start.getTime() + 60 * 60_000).toISOString(), bookings)),
    }));
  const best = rows.filter((row) => row.next).sort((a, b) => a.next!.getTime() - b.next!.getTime())[0];

  return <Modal visible={visible} animationType="slide" onRequestClose={() => { setScanning(false); onClose(); }}>
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan to Charge</Text>
        <Pressable onPress={() => { setScanning(false); onClose(); }} accessibilityRole="button" accessibilityLabel="Close scanner"><Text style={styles.close}>✕</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>{BOOKING_CONFIG.apartmentName} · {vehicle?.name ?? 'Select a vehicle to see compatible chargers'}</Text>
        {scanning ? <>
          <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const id = chargerFromCode(data);
              setScanning(false);
              if (id) { setScannedId(id); setMessage(`Charger ${id} selected. Review its slot below.`); }
              else setMessage('This QR code does not match a charger in this apartment.');
            }} />
          <Pressable onPress={() => setScanning(false)} style={styles.secondary}><Text style={styles.secondaryText}>Close camera</Text></Pressable>
        </> : <Pressable onPress={() => void startScan()} style={styles.scanButton} accessibilityRole="button">
          <Text style={styles.scanText}>▣  Scan charger QR</Text>
        </Pressable>}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Text style={styles.section}>Available booking slots now</Text>
        <Text style={styles.hint}>For a 1-hour session. Charger live status is checked separately before charging starts.</Text>
        {best ? <Text style={styles.best}>Best slot · {formatTime(best.next!.toISOString())} on Charger {best.charger.id}</Text>
          : <Text style={styles.empty}>No compatible 1-hour slot remains today.</Text>}
        {rows.map(({ charger, next }) => <View key={charger.id} style={[styles.row, scannedId === charger.id && styles.selected]}>
          <View><Text style={styles.charger}>Charger {charger.id}</Text><Text style={styles.detail}>{charger.connectorType} · {charger.ratedPowerKw} kW rated</Text></View>
          <Text style={styles.slot}>{next ? formatTime(next.toISOString()) : 'No slot today'}</Text>
        </View>)}
        <Text style={styles.note}>Scanning identifies a charger only. A booking does not start a physical charging session in this prototype.</Text>
      </ScrollView>
      <Pressable onPress={() => { setScanning(false); onViewSlots(); }} style={styles.proceed} accessibilityRole="button">
        <Text style={styles.proceedText}>View and book slots</Text>
      </Pressable>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  title: { color: '#17233B', fontSize: 20, fontWeight: '600' },
  close: { color: '#53627A', fontSize: 21, padding: 6 },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  subtitle: { color: '#7A879B', fontSize: 12 },
  scanButton: { borderRadius: 12, backgroundColor: '#EAF2FF', alignItems: 'center', paddingVertical: 22, marginTop: 18 },
  scanText: { color: '#255CB8', fontSize: 14, fontWeight: '600' },
  camera: { height: 240, borderRadius: 12, overflow: 'hidden', marginTop: 18 },
  secondary: { alignSelf: 'center', padding: 12 }, secondaryText: { color: '#2563EB' },
  message: { color: '#48607E', fontSize: 12, marginTop: 12 },
  section: { color: '#25344C', fontSize: 14, fontWeight: '600', marginTop: 24 },
  hint: { color: '#8792A3', fontSize: 11, marginTop: 4, lineHeight: 16 },
  best: { color: '#255BAC', backgroundColor: '#EFF5FF', borderRadius: 10, padding: 12, marginTop: 15, fontSize: 12, fontWeight: '600' },
  empty: { color: '#8B95A4', fontSize: 12, marginTop: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#EEF1F5', paddingVertical: 15 },
  selected: { backgroundColor: '#F3F8FF' },
  charger: { color: '#26364D', fontSize: 13, fontWeight: '600' },
  detail: { color: '#8490A1', fontSize: 11, marginTop: 3 },
  slot: { color: '#188365', fontSize: 12, fontWeight: '600' },
  note: { color: '#96A0AE', fontSize: 11, lineHeight: 16, marginTop: 22 },
  proceed: { margin: 20, backgroundColor: '#2563EB', borderRadius: 11, alignItems: 'center', padding: 14 },
  proceedText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
