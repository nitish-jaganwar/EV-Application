import React from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ChargingReceipt } from '@/services/transactionHistoryService';

interface Props {
  visible: boolean;
  receipt: ChargingReceipt | null;
  onClose: () => void;
}

export default function ReceiptDetailModal({ visible, receipt, onClose }: Props) {
  if (!receipt) return null;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Charging Receipt</Text>
              <View style={styles.badgeSuccess}>
                <Text style={styles.badgeSuccessText}>● {receipt.status.toUpperCase()}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Amount Banner */}
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Total Billed to Society Maintenance</Text>
              <Text style={styles.amountValue}>₹{receipt.totalCost.toFixed(2)}</Text>
              <View style={styles.ledgerPill}>
                <Text style={styles.ledgerPillText}>
                  ✓ Flat A-402 (Nitish) Monthly Ledger
                </Text>
              </View>
            </View>

            {/* Receipt Summary Table */}
            <View style={styles.detailsCard}>
              <Text style={styles.cardSectionTitle}>Session Breakdown</Text>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Charging Bay</Text>
                <Text style={styles.rowValue}>{receipt.bayName} ({receipt.chargerId})</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Started At</Text>
                <Text style={styles.rowValue}>{formatDate(receipt.startTime)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Ended At</Text>
                <Text style={styles.rowValue}>{formatDate(receipt.endTime)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Duration</Text>
                <Text style={styles.rowValue}>{receipt.durationMins} minutes</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Energy Consumed</Text>
                <Text style={[styles.rowValue, styles.highlightValue]}>
                  {receipt.energyKwh.toFixed(3)} kWh
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Active Society Tariff</Text>
                <Text style={styles.rowValue}>₹{receipt.tariffRate.toFixed(2)} / kWh</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Stop Reason</Text>
                <Text style={styles.rowValue}>{receipt.stoppedReason || 'User App'}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>OCPP Transaction ID</Text>
                <Text style={styles.rowMono}>{receipt.transactionId}</Text>
              </View>
            </View>

            {/* Note Box */}
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                💡 No online payment needed. This energy cost is automatically logged to your flat maintenance account as per society bylaws.
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Action */}
          <View style={styles.footer}>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close Receipt</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeSuccessText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  amountCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  ledgerPill: {
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ledgerPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  highlightValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  rowMono: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#64748B',
    maxWidth: '55%',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 6,
  },
  noteBox: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1E40AF',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  doneBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
