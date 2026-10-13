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

interface HistoricalChargingSession {
  id: string;
  dateStr: string;
  chargerName: string;
  bayNumber: string;
  vehicleName: string;
  plateNumber: string;
  energyKwh: number;
  ratePerKwh: number;
  totalCost: number;
  mode: 'WALK_IN' | 'RESERVED';
  durationMins: number;
}

// Sample recent resident charging sessions logged to society ledger
const MOCK_HISTORICAL_SESSIONS: HistoricalChargingSession[] = [
  {
    id: 'sess-104',
    dateStr: '11 Oct 2026 · 05:15 PM - 07:10 PM',
    chargerName: 'Charger C1 (Fast AC)',
    bayNumber: 'Bay 01',
    vehicleName: 'Tata Nexon EV',
    plateNumber: 'MP 04 AB 1234',
    energyKwh: 14.8,
    ratePerKwh: 11,
    totalCost: 162.8,
    mode: 'RESERVED',
    durationMins: 115,
  },
  {
    id: 'sess-103',
    dateStr: '08 Oct 2026 · 08:30 PM - 10:00 PM',
    chargerName: 'Charger C1 (Fast AC)',
    bayNumber: 'Bay 01',
    vehicleName: 'Tata Nexon EV',
    plateNumber: 'MP 04 AB 1234',
    energyKwh: 11.2,
    ratePerKwh: 15,
    totalCost: 168.0,
    mode: 'WALK_IN',
    durationMins: 90,
  },
  {
    id: 'sess-102',
    dateStr: '05 Oct 2026 · 07:00 AM - 08:45 AM',
    chargerName: 'Charger C5 (DC Fast)',
    bayNumber: 'Bay 05',
    vehicleName: 'Tata Nexon EV',
    plateNumber: 'MP 04 AB 1234',
    energyKwh: 22.5,
    ratePerKwh: 14,
    totalCost: 315.0,
    mode: 'RESERVED',
    durationMins: 105,
  },
  {
    id: 'sess-101',
    dateStr: '02 Oct 2026 · 06:00 PM - 07:30 PM',
    chargerName: 'Charger C3 (2W Socket)',
    bayNumber: 'Bay 03',
    vehicleName: 'Hero Vida V1 Pro',
    plateNumber: 'MP 04 74207',
    energyKwh: 3.8,
    ratePerKwh: 9,
    totalCost: 34.2,
    mode: 'RESERVED',
    durationMins: 90,
  },
];

export default function ChargingRecords({ loading, error, ownerId }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!ownerId) {
      setBookings([]);
      return;
    }
    let active = true;
    bookingRepository
      .listForOwner(ownerId)
      .then((result) => {
        if (active) setBookings(result);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ownerId]);

  const upcomingBookings = bookings.filter(
    (b) => b.status === 'CONFIRMED' && Date.parse(b.endsAt) > Date.now()
  );

  const totalMonthlyKwh = MOCK_HISTORICAL_SESSIONS.reduce(
    (acc, item) => acc + item.energyKwh,
    0
  );
  const totalMonthlyAmount = MOCK_HISTORICAL_SESSIONS.reduce(
    (acc, item) => acc + item.totalCost,
    0
  );

  return (
    <View style={styles.root}>
      {/* Title */}
      <Text style={styles.title}>Society Ledger & Charging History</Text>
      <Text style={styles.subtitle}>
        Transparent monthly consumption billed to your flat maintenance
      </Text>

      {/* Monthly Statement Card */}
      <View style={styles.statementCard}>
        <View style={styles.statementHeader}>
          <View>
            <Text style={styles.monthTag}>CURRENT BILLING CYCLE</Text>
            <Text style={styles.monthTitle}>October 2026</Text>
          </View>
          <View style={styles.ledgerBadge}>
            <Text style={styles.ledgerBadgeText}>Post-Paid Ledger</Text>
          </View>
        </View>

        <Text style={styles.flatNote}>
          Billed to: <Text style={styles.flatBold}>Tower A - 402 (Nitish)</Text>
        </Text>

        <View style={styles.statGrid}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Total Units</Text>
            <Text style={styles.statValue}>{totalMonthlyKwh.toFixed(1)} kWh</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Total Amount</Text>
            <Text style={styles.statValueGreen}>₹{totalMonthlyAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Sessions</Text>
            <Text style={styles.statValue}>{MOCK_HISTORICAL_SESSIONS.length}</Text>
          </View>
        </View>

        <View style={styles.societyBillingNotice}>
          <Text style={styles.noticeIcon}>ℹ️</Text>
          <Text style={styles.noticeText}>
            No in-app payment required. This amount will be appended to your monthly society maintenance bill on 1st November.
          </Text>
        </View>
      </View>

      {/* Upcoming Slots (If Any) */}
      {upcomingBookings.length > 0 && (
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionHeader}>Upcoming Reserved Slots</Text>
          {upcomingBookings.map((b) => (
            <View key={b.id} style={styles.upcomingCard}>
              <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingCharger}>Charger {b.chargerId}</Text>
                <Text style={styles.upcomingTime}>
                  {new Date(b.startsAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.upcomingDuration}>
                  Duration: {formatDuration((Date.parse(b.endsAt) - Date.parse(b.startsAt)) / 60000)}
                </Text>
              </View>
              <View style={styles.confirmedPill}>
                <Text style={styles.confirmedPillText}>CONFIRMED</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Session Receipts List */}
      <Text style={styles.sectionHeader}>Past Charging Receipts</Text>

      {MOCK_HISTORICAL_SESSIONS.map((item) => (
        <View key={item.id} style={styles.receiptCard}>
          {/* Header Row */}
          <View style={styles.receiptTop}>
            <View>
              <Text style={styles.receiptBay}>
                {item.chargerName} • {item.bayNumber}
              </Text>
              <Text style={styles.receiptDate}>{item.dateStr}</Text>
            </View>
            <View
              style={[
                styles.modeTag,
                item.mode === 'RESERVED' ? styles.modeReserved : styles.modeWalkIn,
              ]}
            >
              <Text
                style={[
                  styles.modeTagText,
                  item.mode === 'RESERVED'
                    ? styles.modeReservedText
                    : styles.modeWalkInText,
                ]}
              >
                {item.mode === 'RESERVED' ? 'Reserved (Save)' : 'Immediate Walk-in'}
              </Text>
            </View>
          </View>

          {/* Vehicle Info */}
          <View style={styles.vehicleRow}>
            <Text style={styles.vehicleText}>
              🚗 {item.vehicleName} ({item.plateNumber})
            </Text>
            <Text style={styles.durationText}>{item.durationMins} mins</Text>
          </View>

          {/* Metric Details */}
          <View style={styles.receiptMetricsBox}>
            <View style={styles.receiptMetricItem}>
              <Text style={styles.receiptMetricLabel}>Energy Used</Text>
              <Text style={styles.receiptMetricVal}>{item.energyKwh.toFixed(1)} kWh</Text>
            </View>
            <View style={styles.receiptMetricItem}>
              <Text style={styles.receiptMetricLabel}>Tariff Rate</Text>
              <Text style={styles.receiptMetricVal}>₹{item.ratePerKwh}/kWh</Text>
            </View>
            <View style={styles.receiptMetricItem}>
              <Text style={styles.receiptMetricLabel}>Session Cost</Text>
              <Text style={styles.receiptMetricValTotal}>₹{item.totalCost.toFixed(2)}</Text>
            </View>
          </View>

          {/* Ledger Tag */}
          <View style={styles.ledgerTagRow}>
            <Text style={styles.ledgerTagIcon}>✓</Text>
            <Text style={styles.ledgerTagLabel}>
              Logged in Flat 402 Society Maintenance Ledger
            </Text>
          </View>
        </View>
      ))}

      <Text style={styles.footerNote}>
        Session measurements are recorded by physical sub-meters installed at the apartment basement parking bays.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110 },
  title: { color: '#0F172A', fontSize: 20, fontWeight: '600' },
  subtitle: { color: '#64748B', fontSize: 13, marginTop: 4, lineHeight: 18 },

  // Statement Card
  statementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  statementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  monthTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  monthTitle: { fontSize: 20, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  ledgerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ledgerBadgeText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },
  flatNote: { fontSize: 13, color: '#64748B', marginTop: 6 },
  flatBold: { fontWeight: '600', color: '#0F172A' },

  statGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    alignItems: 'center',
  },
  statCol: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  statValue: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginTop: 4 },
  statValueGreen: { fontSize: 16, fontWeight: '600', color: '#16A34A', marginTop: 4 },
  statDivider: { width: 1, height: 26, backgroundColor: '#E2E8F0' },

  societyBillingNotice: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    alignItems: 'center',
    gap: 8,
  },
  noticeIcon: { fontSize: 14 },
  noticeText: { fontSize: 11, color: '#166534', flex: 1, lineHeight: 16 },

  // Upcoming Slots
  upcomingSection: { marginTop: 22 },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 24,
    marginBottom: 12,
  },
  upcomingCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  upcomingLeft: { flex: 1 },
  upcomingCharger: { fontSize: 14, fontWeight: '600', color: '#1E3A8A' },
  upcomingTime: { fontSize: 13, color: '#2563EB', marginTop: 2, fontWeight: '500' },
  upcomingDuration: { fontSize: 11, color: '#64748B', marginTop: 2 },
  confirmedPill: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confirmedPillText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },

  // Receipt Cards
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  receiptTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  receiptBay: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  receiptDate: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modeTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  modeReserved: { backgroundColor: '#DCFCE7' },
  modeWalkIn: { backgroundColor: '#EFF6FF' },
  modeTagText: { fontSize: 10, fontWeight: '600' },
  modeReservedText: { color: '#15803D' },
  modeWalkInText: { color: '#2563EB' },

  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  vehicleText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  durationText: { fontSize: 12, color: '#64748B' },

  receiptMetricsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  receiptMetricItem: { alignItems: 'flex-start' },
  receiptMetricLabel: { fontSize: 10, color: '#64748B' },
  receiptMetricVal: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  receiptMetricValTotal: { fontSize: 14, fontWeight: '600', color: '#16A34A', marginTop: 2 },

  ledgerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  ledgerTagIcon: { fontSize: 11, color: '#16A34A', fontWeight: '700' },
  ledgerTagLabel: { fontSize: 11, color: '#15803D', fontWeight: '500' },

  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});
