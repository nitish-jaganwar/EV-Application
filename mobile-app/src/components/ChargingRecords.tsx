import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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

export default function ChargingRecords({ ownerId = 'FLAT_A402_NITISH', refreshTrigger = 0 }: Props) {
  const [receipts, setReceipts] = useState<ChargingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ChargingReceipt | null>(null);

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

  const totalMonthlyKwh = receipts.reduce((acc, item) => acc + item.energyKwh, 0);
  const totalMonthlyAmount = receipts.reduce((acc, item) => acc + item.totalCost, 0);

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

  return (
    <View style={styles.root}>
      {/* Title */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Society Ledger & Records</Text>
          <Text style={styles.subtitle}>
            Live OCPP transactions billed to flat maintenance
          </Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshBtn} hitSlop={8}>
          <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
        </Pressable>
      </View>

      {/* Monthly Statement Card */}
      <View style={styles.statementCard}>
        <View style={styles.statementHeader}>
          <View>
            <Text style={styles.monthTag}>CURRENT BILLING CYCLE</Text>
            <Text style={styles.monthTitle}>
              {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
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
            <Text style={styles.statValueGreen}>₹{totalMonthlyAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Sessions</Text>
            <Text style={styles.statValue}>{receipts.length}</Text>
          </View>
        </View>

        <View style={styles.societyBillingNotice}>
          <Text style={styles.noticeIcon}>ℹ️</Text>
          <Text style={styles.noticeText}>
            No in-app payment required. Automatically appended to your society maintenance ledger.
          </Text>
        </View>
      </View>

      {/* Session Receipts List */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Charging Receipts History</Text>
        <Text style={styles.sectionHint}>Tap for detailed receipt</Text>
      </View>

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loaderText}>Syncing CitrineOS ledger...</Text>
        </View>
      ) : receipts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>⚡</Text>
          <Text style={styles.emptyTitle}>No Charging Sessions Yet</Text>
          <Text style={styles.emptyDesc}>
            Your completed charging sessions at Bay 01 will automatically appear here with full unit and cost breakdowns.
          </Text>
        </View>
      ) : (
        receipts.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.receiptCard, pressed && styles.receiptCardPressed]}
            onPress={() => setSelectedReceipt(item)}
          >
            {/* Top row: Bay & Amount */}
            <View style={styles.receiptTopRow}>
              <View style={styles.receiptBayBox}>
                <Text style={styles.receiptBayTitle}>{item.bayName} · {item.chargerId}</Text>
                <Text style={styles.receiptDate}>{formatDate(item.startTime)}</Text>
              </View>
              <View style={styles.receiptCostBox}>
                <Text style={styles.receiptCostAmount}>₹{item.totalCost.toFixed(2)}</Text>
                <View style={styles.completedPill}>
                  <Text style={styles.completedPillText}>✓ {item.status.toUpperCase()}</Text>
                </View>
              </View>
            </View>

            {/* Metrics pills */}
            <View style={styles.metricsRow}>
              <View style={styles.metricPill}>
                <Text style={styles.metricPillLabel}>Energy: </Text>
                <Text style={styles.metricPillVal}>{item.energyKwh} kWh</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricPillLabel}>Duration: </Text>
                <Text style={styles.metricPillVal}>{item.durationMins}m</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricPillLabel}>Rate: </Text>
                <Text style={styles.metricPillVal}>₹{item.tariffRate}/kWh</Text>
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
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshBtnText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
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
    marginBottom: 20,
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
  },
  statValueGreen: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  societyBillingNotice: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 8,
  },
  noticeIcon: {
    fontSize: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
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
    gap: 8,
    borderTopWidth: 1,
    borderColor: '#F8FAFC',
    paddingTop: 8,
  },
  metricPill: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metricPillLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  metricPillVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  chevron: {
    marginLeft: 'auto',
    fontSize: 18,
    fontWeight: '700',
    color: '#94A3B8',
  },
});
