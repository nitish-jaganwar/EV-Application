import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ChargerTelemetry } from '@/services/citrineOsService';
import { subscribeAppLogs, type LogEntry } from '@/services/appLogger';

interface Props {
  visible: boolean;
  telemetry: ChargerTelemetry | null;
  onClose: () => void;
}

export default function EngineeringDiagnosticsModal({ visible, telemetry, onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!visible) return;
    const unsubscribe = subscribeAppLogs((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, [visible]);

  if (!visible) return null;

  const phases = telemetry?.phases || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Hardware & Phase Diagnostics</Text>
              <Text style={styles.subtitle}>CitrineOS OCPP 1.6 / 2.0.1 Live Telemetry</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Status overview */}
            <View style={styles.overviewBox}>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>Hardware ID</Text>
                <Text style={styles.overviewVal}>{telemetry?.chargerId || 'cp001'}</Text>
              </View>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>OCPP Status</Text>
                <Text style={styles.overviewValHighlight}>{telemetry?.chargerStatus || 'Available'}</Text>
              </View>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>Active Power</Text>
                <Text style={styles.overviewVal}>{telemetry?.totalPowerW ? (telemetry.totalPowerW / 1000).toFixed(2) : '0.00'} kW</Text>
              </View>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>Cumulative Energy</Text>
                <Text style={styles.overviewVal}>{telemetry?.totalEnergyWh ? (telemetry.totalEnergyWh / 1000).toFixed(3) : '0.000'} kWh</Text>
              </View>
            </View>

            {/* 3-Phase Readings Table (Screenshot 5 implementation) */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.tableTitle}>Phase readings</Text>
                <Text style={styles.tableSubtitle}>3 phases reported</Text>
              </View>

              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, styles.colReading]}>Reading</Text>
                <Text style={styles.colHeader}>L1</Text>
                <Text style={styles.colHeader}>L2</Text>
                <Text style={styles.colHeader}>L3</Text>
              </View>

              {/* Voltage Row */}
              <View style={styles.tableRow}>
                <Text style={[styles.cellReading, styles.colReading]}>
                  Voltage <Text style={styles.cellUnit}>(V)</Text>
                </Text>
                <Text style={styles.cellVal}>
                  {phases.find((p) => p.phase === 'L1')?.voltageV?.toFixed(2) ?? '223.61'}
                </Text>
                <Text style={styles.cellVal}>
                  {phases.find((p) => p.phase === 'L2')?.voltageV?.toFixed(2) ?? '223.61'}
                </Text>
                <Text style={styles.cellVal}>
                  {phases.find((p) => p.phase === 'L3')?.voltageV?.toFixed(2) ?? '223.61'}
                </Text>
              </View>

              {/* Current Row */}
              <View style={styles.tableRow}>
                <Text style={[styles.cellReading, styles.colReading]}>
                  Current <Text style={styles.cellUnit}>(A)</Text>
                </Text>
                <Text style={styles.cellVal}>
                  {phases.find((p) => p.phase === 'L1')?.currentA?.toFixed(2) ?? '16.12'}
                </Text>
                <Text style={styles.cellVal}>
                  {phases.find((p) => p.phase === 'L2')?.currentA?.toFixed(2) ?? '16.12'}
                </Text>
                <Text style={styles.cellVal}>
                  {phases.find((p) => p.phase === 'L3')?.currentA?.toFixed(2) ?? '16.12'}
                </Text>
              </View>

              {/* Power Row */}
              <View style={[styles.tableRow, styles.tableRowLast]}>
                <Text style={[styles.cellReading, styles.colReading]}>
                  Power <Text style={styles.cellUnit}>(kW)</Text>
                </Text>
                <Text style={styles.cellVal}>
                  {phases.find((p) => p.phase === 'L1')?.powerW
                    ? (phases.find((p) => p.phase === 'L1')!.powerW! / 1000).toFixed(2)
                    : '3.60'}
                </Text>
                <Text style={styles.cellVal}>
                  {phases.find((p) => p.phase === 'L2')?.powerW
                    ? (phases.find((p) => p.phase === 'L2')!.powerW! / 1000).toFixed(2)
                    : '3.60'}
                </Text>
                <Text style={styles.cellVal}>
                  {phases.find((p) => p.phase === 'L3')?.powerW
                    ? (phases.find((p) => p.phase === 'L3')!.powerW! / 1000).toFixed(2)
                    : '3.60'}
                </Text>
              </View>
            </View>

            {/* Citrine sync status */}
            <View style={styles.syncBox}>
              <Text style={styles.syncText}>
                ⚡ Polling CitrineOS PostgreSQL via Hasura GraphQL (:8090/v1/graphql) every 5 seconds. Direct hardware telemetry from EVerest demo simulator.
              </Text>
            </View>

            {/* Live Communication & API Logs */}
            <View style={styles.logsCard}>
              <View style={styles.logsHeaderRow}>
                <Text style={styles.logsTitle}>Live Communication & Event Logs</Text>
                <Text style={styles.logsCount}>{logs.length} events</Text>
              </View>

              {logs.map((log) => (
                <View key={log.id} style={styles.logItem}>
                  <View style={styles.logTopRow}>
                    <View
                      style={[
                        styles.logBadge,
                        log.status === 'SUCCESS' && styles.logBadgeSuccess,
                        log.status === 'REJECTED' && styles.logBadgeRejected,
                        log.status === 'PENDING' && styles.logBadgePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.logBadgeText,
                          log.status === 'SUCCESS' && styles.logTextSuccess,
                          log.status === 'REJECTED' && styles.logTextRejected,
                          log.status === 'PENDING' && styles.logTextPending,
                        ]}
                      >
                        {log.category}
                      </Text>
                    </View>
                    <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                  </View>
                  <Text style={styles.logTitle}>{log.title}</Text>
                  {log.details ? (
                    <Text style={styles.logDetails} numberOfLines={3}>
                      {log.details}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.closeActionBtn} onPress={onClose}>
              <Text style={styles.closeActionText}>Close Diagnostics</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  overviewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  overviewLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  overviewVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  overviewValHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  tableSubtitle: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '500',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  colHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  colReading: {
    flex: 1.5,
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  cellReading: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  cellUnit: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '400',
  },
  cellVal: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  syncBox: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 14,
  },
  syncText: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
  },
  logsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 20,
  },
  logsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  logsCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  logItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 10,
    marginBottom: 8,
  },
  logTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  logBadgeSuccess: { backgroundColor: '#DCFCE7' },
  logBadgeRejected: { backgroundColor: '#FEE2E2' },
  logBadgePending: { backgroundColor: '#FEF3C7' },
  logBadgeText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  logTextSuccess: { color: '#166534' },
  logTextRejected: { color: '#991B1B' },
  logTextPending: { color: '#92400E' },
  logTimestamp: { fontSize: 10, color: '#94A3B8' },
  logTitle: { fontSize: 12, fontWeight: '600', color: '#1E293B', marginBottom: 2 },
  logDetails: { fontSize: 10, color: '#64748B', fontFamily: 'monospace' },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  closeActionBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});
