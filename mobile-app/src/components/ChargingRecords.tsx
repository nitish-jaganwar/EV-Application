import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  fetchUserChargingHistory,
  type ChargingReceipt,
} from '@/services/transactionHistoryService';
import ReceiptDetailModal from '@/components/modals/ReceiptDetailModal';

interface Props {
  ownerId?: string | null;
  refreshTrigger?: number;
  points?: any;
  loading?: boolean;
  error?: string | null;
}

// Month selector: current month + 5 previous months
function buildMonths(): { label: string; year: number; month: number }[] {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return result;
}

const MONTHS = buildMonths();

// Clean display name: strip internal OCPP ID from user-facing labels
function friendlyBayName(bayName: string, chargerId: string): string {
  if (chargerId === 'cp001' || bayName.toLowerCase().includes('bay 01')) return 'Bay 01 · Tower A';
  return bayName;
}

export default function ChargingRecords({ ownerId = 'FLAT_A402_NITISH', refreshTrigger = 0 }: Props) {
  const [receipts, setReceipts] = useState<ChargingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ChargingReceipt | null>(null);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const data = await fetchUserChargingHistory(ownerId || 'FLAT_A402_NITISH');
      setReceipts(data);
    } catch (err) {
      console.warn('Error loading charging history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, refreshTrigger]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const selectedMonth = MONTHS[selectedMonthIdx];

  // Month-filtered base receipts
  const monthReceipts = useMemo(() => {
    return receipts.filter((r) => {
      const d = new Date(r.startTime);
      return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month;
    });
  }, [receipts, selectedMonth]);

  // Search and quick-filter matching
  const displayedReceipts = useMemo(() => {
    return monthReceipts.filter((item) => {
      if (filterActiveOnly && item.energyKwh <= 0.05) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const bay = friendlyBayName(item.bayName, item.chargerId).toLowerCase();
      const txn = (item.transactionId || '').toLowerCase();
      const date = item.startTime.toLowerCase();
      return bay.includes(q) || txn.includes(q) || date.includes(q);
    });
  }, [monthReceipts, searchQuery, filterActiveOnly]);

  const totalMonthlyKwh = monthReceipts.reduce((acc, item) => acc + item.energyKwh, 0);
  const totalMonthlyAmount = monthReceipts.reduce((acc, item) => acc + item.totalCost, 0);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Export as formatted statement or CSV
  const handleExportShare = async () => {
    const csvHeader = 'Date,Bay,Energy_kWh,Rate_INR,Cost_INR,Status';
    const csvRows = monthReceipts.map((r) =>
      `"${formatDate(r.startTime)}","${friendlyBayName(r.bayName, r.chargerId)}",${r.energyKwh},${r.tariffRate},${r.totalCost.toFixed(2)},${r.status}`
    );
    const text = [
      `tBits EV Charging Statement — ${selectedMonth.label}`,
      `Resident: Tower A - 402 (Nitish) | Post-Paid Ledger`,
      `Total Consumption: ${totalMonthlyKwh.toFixed(2)} kWh | Total Bill: ₹${totalMonthlyAmount.toFixed(2)}`,
      ``,
      csvHeader,
      ...csvRows,
      ``,
      `Billed directly to flat monthly maintenance statement.`,
    ].join('\n');

    try {
      await Share.share({ message: text, title: `EV Statement ${selectedMonth.label}` });
    } catch (err) {
      Alert.alert('Could not export statement', 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      {/* Title Row with Refresh Icon */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Monthly Statement</Text>
          <Text style={styles.subtitle}>
            EV consumption billed to maintenance ledger
          </Text>
        </View>
        <Pressable
          onPress={onRefresh}
          style={styles.refreshBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Refresh records"
        >
          <Text style={styles.refreshBtnIcon}>{refreshing ? '…' : '↻'}</Text>
        </Pressable>
      </View>

      {/* Month Selector Horizontal Strip */}
      <View style={styles.monthSelectorRow}>
        {MONTHS.map((m, idx) => (
          <Pressable
            key={m.label}
            style={[styles.monthChip, idx === selectedMonthIdx && styles.monthChipActive]}
            onPress={() => setSelectedMonthIdx(idx)}
          >
            <Text style={[styles.monthChipText, idx === selectedMonthIdx && styles.monthChipTextActive]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Monthly Summary Ledger Card */}
      <View style={styles.statementCard}>
        <View style={styles.statementHeader}>
          <View>
            <Text style={styles.monthTag}>BILLING CYCLE</Text>
            <Text style={styles.monthTitle}>{selectedMonth.label}</Text>
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
            <Text style={styles.statValue}>{totalMonthlyKwh.toFixed(2)} kWh</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Total Amount</Text>
            <Text style={styles.statValue}>₹{totalMonthlyAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Sessions</Text>
            <Text style={styles.statValue}>{monthReceipts.length}</Text>
          </View>
        </View>

        {/* Export / Share Button */}
        <Pressable style={styles.exportBtn} onPress={handleExportShare}>
          <Text style={styles.exportBtnIcon}>↑</Text>
          <Text style={styles.exportBtnText}>Export / Share CSV Statement</Text>
        </Pressable>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search bay or date..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Text style={styles.clearSearchText}>✕</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.filterToggleBtn, filterActiveOnly && styles.filterToggleBtnActive]}
          onPress={() => setFilterActiveOnly((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Filter meaningful charges"
        >
          <Text style={[styles.filterToggleText, filterActiveOnly && styles.filterToggleTextActive]}>
            {filterActiveOnly ? '>0 kWh ✓' : 'All'}
          </Text>
        </Pressable>
      </View>

      {/* Session Receipts List Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>
          Charging Receipts ({displayedReceipts.length})
        </Text>
        <Text style={styles.sectionHint}>Tap for receipt detail</Text>
      </View>

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loaderText}>Loading transactions...</Text>
        </View>
      ) : displayedReceipts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>⚡</Text>
          <Text style={styles.emptyTitle}>No matching sessions</Text>
          <Text style={styles.emptyDesc}>
            {searchQuery
              ? `No sessions found matching "${searchQuery}".`
              : `No charging activity recorded in ${selectedMonth.label}.`}
          </Text>
        </View>
      ) : (
        displayedReceipts.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.receiptCard, pressed && styles.receiptCardPressed]}
            onPress={() => setSelectedReceipt(item)}
          >
            {/* Top row: Bay Name + Date | Cost */}
            <View style={styles.receiptTopRow}>
              <View style={styles.receiptBayBox}>
                <Text style={styles.receiptBayTitle}>
                  {friendlyBayName(item.bayName, item.chargerId)}
                </Text>
                <Text style={styles.receiptDate}>{formatDate(item.startTime)}</Text>
              </View>
              <View style={styles.receiptCostBox}>
                <Text style={[styles.receiptCostAmount, { fontVariant: ['tabular-nums'] }]}>
                  ₹{item.totalCost.toFixed(2)}
                </Text>
                <View style={styles.completedPill}>
                  <Text style={styles.completedPillText}>✓ {item.status.toUpperCase()}</Text>
                </View>
              </View>
            </View>

            {/* Clean 3-Column Metrics (Energy | Duration | Rate) */}
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricItemLabel}>ENERGY</Text>
                <Text style={[styles.metricItemVal, { fontVariant: ['tabular-nums'] }]}>
                  {item.energyKwh} kWh
                </Text>
              </View>
              <View style={styles.metricItemDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricItemLabel}>DURATION</Text>
                <Text style={[styles.metricItemVal, { fontVariant: ['tabular-nums'] }]}>
                  {item.durationMins} min
                </Text>
              </View>
              <View style={styles.metricItemDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricItemLabel}>RATE</Text>
                <Text style={[styles.metricItemVal, { fontVariant: ['tabular-nums'] }]}>
                  ₹{item.tariffRate}/kWh
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        ))
      )}

      {/* Detailed Receipt Modal */}
      <ReceiptDetailModal
        visible={selectedReceipt !== null}
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: '#F1F5F9',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnIcon: {
    fontSize: 17,
    color: '#334155',
    fontWeight: '700',
  },
  monthSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  monthChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  monthChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  monthChipTextActive: {
    color: '#FFFFFF',
  },
  statementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  statementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  monthTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  ledgerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ledgerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  flatNote: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  flatBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  statGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  exportBtnIcon: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  // Search and Filter controls
  searchFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchIcon: {
    fontSize: 13,
    color: '#64748B',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  clearSearchText: {
    fontSize: 12,
    color: '#94A3B8',
    paddingHorizontal: 4,
  },
  filterToggleBtn: {
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterToggleBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterToggleTextActive: {
    color: '#2563EB',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionHint: {
    fontSize: 11,
    color: '#94A3B8',
  },
  loaderBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  receiptCardPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  receiptTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  receiptBayBox: {
    flex: 1,
  },
  receiptBayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  receiptDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  receiptCostBox: {
    alignItems: 'flex-end',
  },
  receiptCostAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  completedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  completedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricItemLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricItemVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricItemDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  chevron: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#94A3B8',
  },
});
