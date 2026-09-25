import type { MeterPoint } from '@/services/chargerHistory';
import { bookingRepository } from '@/features/booking/bookingRepository';
import { formatDuration } from '@/features/booking/bookingRules';
import type { Booking } from '@/features/booking/bookingTypes';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  points: MeterPoint[];
  loading: boolean;
  error: string | null;
  ownerId: string | null;
}

function reading(value: number | undefined, unit: string): string {
  return value === undefined ? '—' : `${value.toFixed(2)} ${unit}`;
}

export default function ChargingRecords({ points, loading, error, ownerId }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingError, setBookingError] = useState(false);
  useEffect(() => {
    if (!ownerId) { setBookings([]); return; }
    let active = true;
    bookingRepository.listForOwner(ownerId).then((result) => {
      if (active) { setBookings(result); setBookingError(false); }
    }).catch(() => { if (active) setBookingError(true); });
    return () => { active = false; };
  }, [ownerId]);
  const ordered = [...points].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const latest = ordered[0];
  const confirmed = bookings.filter((booking) => booking.status === 'CONFIRMED');
  const upcoming = confirmed.filter((booking) => Date.parse(booking.endsAt) > Date.now());
  return <View style={styles.root}>
    <Text style={styles.title}>Records</Text>
    <Text style={styles.subtitle}>Your demo bookings and available charger meter reports</Text>

    <View style={styles.stats}>
      <View style={styles.stat}><Text style={styles.statValue}>{confirmed.length}</Text><Text style={styles.statLabel}>Booked slots</Text></View>
      <View style={styles.stat}><Text style={styles.statValue}>{upcoming.length}</Text><Text style={styles.statLabel}>Upcoming</Text></View>
      <View style={styles.stat}><Text style={styles.statValue}>{points.length}</Text><Text style={styles.statLabel}>Meter readings</Text></View>
    </View>

    <Text style={styles.section}>Booking history</Text>
    {!ownerId ? <Text style={styles.empty}>Sign in to see your bookings.</Text> : null}
    {bookingError ? <Text style={styles.empty}>Booking history is unavailable.</Text> : null}
    {ownerId && !bookingError && !bookings.length ? <Text style={styles.empty}>No bookings yet.</Text> : null}
    {bookings.map((booking) => <View key={booking.id} style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.date}>{new Date(booking.startsAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
        <Text style={[styles.power, booking.status === 'CANCELLED' && styles.cancelled]}>{booking.status === 'CANCELLED' ? 'Cancelled' : 'Booked'}</Text>
      </View>
      <Text style={styles.detail}>Charger {booking.chargerId} · {formatDuration((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60_000)} · ends {new Date(booking.endsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
    </View>)}

    <Text style={styles.section}>Meter timeline</Text>
    {latest ? <Text style={styles.meterSummary}>Latest power {reading(latest.powerKw, 'kW')} · Cumulative meter {reading(latest.energyKwh, 'kWh')}</Text> : null}
    {loading && !points.length ? <Text style={styles.empty}>Loading meter reports…</Text> : null}
    {error ? <Text style={styles.empty}>Meter history is unavailable: {error}</Text> : null}
    {!loading && !error && !points.length ? <Text style={styles.empty}>No meter reports are available yet.</Text> : null}
    {ordered.map((point) => <View key={point.timestamp} style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.date}>{new Date(point.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
        <Text style={styles.power}>{reading(point.powerKw, 'kW')}</Text>
      </View>
      <Text style={styles.detail}>Energy meter {reading(point.energyKwh, 'kWh')} · Voltage {reading(point.voltageV, 'V')} · Current {reading(point.currentA, 'A')}</Text>
    </View>)}

    <Text style={styles.note}>A complete personal session history needs finalized transactions linked to your account from the backend. Meter total is cumulative and is not energy used in one session.</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { padding: 18, paddingBottom: 110 },
  title: { color: '#17233B', fontSize: 20, fontWeight: '600' },
  subtitle: { color: '#79859A', fontSize: 12, marginTop: 3 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 18 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderColor: '#E5EAF2', borderWidth: 1, borderRadius: 11, padding: 10 },
  statValue: { color: '#1D4B9C', fontSize: 15, fontWeight: '600' },
  statLabel: { color: '#8290A4', fontSize: 10, marginTop: 4 },
  section: { color: '#29364E', fontSize: 14, fontWeight: '600', marginTop: 22, marginBottom: 10 },
  row: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#EDF0F5', paddingVertical: 12, paddingHorizontal: 2 },
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  date: { color: '#26364E', fontSize: 12, fontWeight: '500' },
  power: { color: '#2563EB', fontSize: 12, fontWeight: '600' },
  cancelled: { color: '#8290A4' },
  meterSummary: { color: '#6A7B92', fontSize: 11, marginBottom: 8 },
  detail: { color: '#8390A2', fontSize: 10, marginTop: 4 },
  empty: { color: '#8A96A8', fontSize: 12, paddingVertical: 20 },
  note: { color: '#8B97A8', fontSize: 11, lineHeight: 16, marginTop: 20 },
});
