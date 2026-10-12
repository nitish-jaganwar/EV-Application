import { useAuth } from '@/context/AuthContext';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import LivePowerGauge from '@/components/LivePowerGauge';
import ChargingRecords from '@/components/ChargingRecords';
import LiveTelemetryChart from '@/components/LiveTelemetryChart';
import ParkingScreen from '@/features/parking/ParkingScreen';
import { useParkingNotifications } from '@/features/parking/parkingNotifications';
import ScanToChargeSheet from '@/features/booking/ScanToChargeSheet';
import { useNotifications } from '@/context/NotificationContext';
import { POPULAR_EVS, useVehicle } from '@/context/VehicleContext';
import {
  ChargerTelemetry,
  PhaseTelemetry,
  resolveChargerStatus,
} from '@/services/citrineOsService';
import { useChargerTelemetry } from '@/hooks/use-charger-telemetry';
import { useChargerHistory } from '@/hooks/use-charger-history';
import { stopChargingTransaction } from '@/services/chargerApi';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

// -------------------------------------------------------------
// TYPES & MOCK DATA
// -------------------------------------------------------------
const formatReading = (value?: number, divisor = 1, decimals = 2) =>
  value === undefined || !Number.isFinite(value) ? '—' : (value / divisor).toFixed(decimals);
const formatKw = (value?: number) => `${formatReading(value, 1000)} kW`;
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Not reported' : date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hour12: true,
  });
};

const EMPTY_CHARGER_TELEMETRY: ChargerTelemetry = {
  chargerId: 'cp001',
  connectorId: 1,
  online: false,
  meterTimestamp: new Date().toISOString(),
  chargerStatus: 'Unavailable',
  chargerStatusTimestamp: new Date().toISOString(),
  chargerErrorCode: 'NoError',
  phases: [
    { phase: 'L1' },
    { phase: 'L2' },
    { phase: 'L3' },
  ],
};

const PHASE_READING_ROWS: {
  label: string;
  unit: string;
  field: keyof Omit<PhaseTelemetry, 'phase'>;
  divisor: number;
  decimals: number;
}[] = [
  { label: 'Voltage', unit: 'V', field: 'voltageV', divisor: 1, decimals: 2 },
  { label: 'Current', unit: 'A', field: 'currentA', divisor: 1, decimals: 2 },
  { label: 'Power', unit: 'kW', field: 'powerW', divisor: 1000, decimals: 2 },
  { label: 'Energy', unit: 'kWh', field: 'energyWh', divisor: 1000, decimals: 3 },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  useParkingNotifications(user?.mobile ?? null);
  const { vehicles, selectedVehicle, selectVehicle, addVehicle } = useVehicle();
  const { unreadCount } = useNotifications();
  const { notificationTab, notificationId } = useLocalSearchParams<{ notificationTab?: string; notificationId?: string }>();

  // Active Bottom Tab
  const [activeTab, setActiveTab] = useState<'LIVE' | 'SCHEDULE' | 'RECORDS' | 'SETTINGS'>('LIVE');
  useEffect(() => {
    if (notificationTab === 'LIVE' || notificationTab === 'SCHEDULE' || notificationTab === 'RECORDS') {
      setActiveTab(notificationTab);
    }
  }, [notificationTab, notificationId]);

  // Slot Booking States

  // Power Regulation (Tuya 16A, 24A, 32A)
  const [configuredCurrentLimitA, setConfiguredCurrentLimitA] = useState<number>(16);

  // Modals
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);
  const [vehiclePickerVisible, setVehiclePickerVisible] = useState(false);
  const [addVehicleModalVisible, setAddVehicleModalVisible] = useState(false);
  const [newVehicleModel, setNewVehicleModel] = useState<(typeof POPULAR_EVS)[0] | null>(null);
  const [newPlateNumber, setNewPlateNumber] = useState('');
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [stopChargingModalVisible, setStopChargingModalVisible] = useState(false);
  const [isEndingCharging, setIsEndingCharging] = useState(false);

  const {
    telemetry: liveTelemetry,
    isLoading: isTelemetryLoading,
    error: telemetryError,
    isStale: isTelemetryStale,
    isUsingMock,
  } = useChargerTelemetry();
  const { points: meterHistory, isLoading: isHistoryLoading, error: historyError } = useChargerHistory(liveTelemetry);
  const telemetry = liveTelemetry ?? EMPTY_CHARGER_TELEMETRY;
  const isChargerOffline = telemetry.online === false;
  const reportedDisplayStatus = isChargerOffline
    ? { status: 'Unavailable' as const, source: 'status' as const }
    : resolveChargerStatus(telemetry);
  const hasMeasuredPowerFlow = (telemetry.totalPowerW ?? 0) > 100;
  const hasChargerFault = telemetry.chargerStatus === 'Faulted' || telemetry.chargerErrorCode !== 'NoError';
  const displayStatus = !isChargerOffline && hasMeasuredPowerFlow && !hasChargerFault
    ? { status: 'Charging' as const, source: 'meter' as const }
    : reportedDisplayStatus;
  const isCharging = displayStatus.status === 'Charging';
  const hasPowerFlow = !isTelemetryStale && !isChargerOffline && hasMeasuredPowerFlow;
  const statusLabel = isTelemetryLoading && !liveTelemetry
    ? 'Connecting'
    : displayStatus.status === 'SuspendedEV'
    ? 'Paused by vehicle'
    : displayStatus.status === 'SuspendedEVSE'
      ? 'Paused by charger'
      : displayStatus.status;
  const displayedEnergyWh = telemetry.energyDeliveredWh ?? telemetry.totalEnergyWh;
  const chargerDisplayId = telemetry.chargerId ?? 'cp001';
  const connectionStatus = isTelemetryLoading && !liveTelemetry
    ? 'CONNECTING'
    : telemetry.online === false
      ? 'OFFLINE'
      : isTelemetryStale || Boolean(telemetryError)
        ? 'CONNECTION DELAYED'
        : 'ONLINE';
  const isConnectionOffline = connectionStatus === 'OFFLINE';
  const isConnectionDelayed = connectionStatus === 'CONNECTION DELAYED' || connectionStatus === 'CONNECTING';
  const phasePowerTotalW = telemetry.phases.reduce(
    (total, phase) => total + (phase.powerW ?? 0),
    0,
  );
  const hasCalculatedPhasePower = telemetry.phases.some((phase) => phase.powerW !== undefined);
  const calculatedEnergyDeliveredWh = telemetry.totalEnergyWh !== undefined
    && telemetry.sessionStartEnergyWh !== undefined
    ? Math.max(0, telemetry.totalEnergyWh - telemetry.sessionStartEnergyWh)
    : undefined;
  const activeCurrentLimitA = telemetry.appliedCurrentLimitA ?? configuredCurrentLimitA;
  const availablePowerW = telemetry.availablePowerW ?? (
    telemetry.siteCapacityW !== undefined && telemetry.gridLoadW !== undefined
      ? Math.max(0, telemetry.siteCapacityW - telemetry.gridLoadW)
      : undefined
  );
  const loadUtilizationPercent = telemetry.siteCapacityW !== undefined
    && telemetry.siteCapacityW > 0
    && telemetry.gridLoadW !== undefined
    ? Math.min(100, Math.max(0, (telemetry.gridLoadW / telemetry.siteCapacityW) * 100))
    : undefined;
  const hasActiveTransaction = telemetry.transactionId !== undefined
    && telemetry.transactionEventType !== 'Ended';

  const handleEndCharging = async () => {
    if (telemetry.transactionId === undefined || isEndingCharging) return;

    setIsEndingCharging(true);
    try {
      await stopChargingTransaction(
        chargerDisplayId,
        telemetry.transactionId,
        telemetry.connectorId,
        telemetry.evseId,
      );
      setStopChargingModalVisible(false);
      Alert.alert('End request sent', 'The charger is processing the stop request.');
    } catch (error) {
      Alert.alert(
        'Unable to end charging',
        error instanceof Error ? error.message : 'The stop request could not be sent.',
      );
    } finally {
      setIsEndingCharging(false);
    }
  };

  const reportedPhases = telemetry.phases.filter((phase) =>
    [phase.voltageV, phase.currentA, phase.powerW, phase.energyWh].some((value) =>
      value !== undefined && Number.isFinite(value)
    )
  );
  const phaseLabel = reportedPhases.length === 0 ? 'AC charger' : `${reportedPhases.length}-phase AC`;

  const handleSaveVehicle = () => {
    if (!newVehicleModel || !newPlateNumber.trim()) {
      Alert.alert('Required', 'Please select an EV model and enter registration plate number.');
      return;
    }

    addVehicle({
      ...newVehicleModel,
      plateNumber: newPlateNumber.trim().toUpperCase(),
    });

    setNewPlateNumber('');
    setNewVehicleModel(null);
    setAddVehicleModalVisible(false);
    Alert.alert('Vehicle Added', `${newVehicleModel.name} added to your garage.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* -------------------------------------------------------------
          TOP BAR: BRAND + NOTIFICATION + USER GREETING (COMMON)
      -------------------------------------------------------------- */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <Text style={styles.brandLogo}>⚡ tBits Plug</Text>
          <View style={styles.headerActions}>
          <Pressable
            style={styles.bellButton}
            onPress={() => setNotificationModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Notifications, ${unreadCount} unread`}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.profileButton} onPress={() => setActiveTab('SETTINGS')}
            accessibilityRole="button" accessibilityLabel="Open user profile">
            <Text style={styles.profileInitials}>{user?.fullName?.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U'}</Text>
          </Pressable>
          </View>
        </View>

        {activeTab !== 'SCHEDULE' &&
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingTitle}>Hi, {user?.fullName?.split(' ')[0] || 'Nitish'}!</Text>
            <Text style={styles.greetingSub}>{user?.flatNumber || 'Tower A - 402'} • Resident</Text>
          </View>

          {/* Quick Vehicle Switcher Badge */}
          <Pressable
            style={styles.vehicleHeaderBadge}
            onPress={() => setVehiclePickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Select vehicle"
          >
            <Text style={styles.vehBadgeEmoji}>{selectedVehicle?.icon || '🚗'}</Text>
            <View>
              <Text style={styles.vehBadgeName}>{selectedVehicle?.name || 'Add EV'}</Text>
              <Text style={styles.vehBadgePlate}>{selectedVehicle?.plateNumber || 'No Plate'}</Text>
            </View>
            <Text style={styles.vehBadgeArrow}>▾</Text>
          </Pressable>
        </View>
        }
      </View>

      {/* -------------------------------------------------------------
          TAB 1: LIVE CHARGE (DEFAULT MAIN HOME SCREEN)
      -------------------------------------------------------------- */}
      {activeTab === 'LIVE' && (
        <ScrollView contentContainerStyle={[styles.scrollContent, styles.scrollWithScan, hasActiveTransaction && styles.scrollWithStop]} showsVerticalScrollIndicator={false}>
{/* Active Status Header Pill */}
          <View style={[
            styles.liveSessionBadge,
            !isCharging && styles.sessionBadgeIdle,
            hasChargerFault && styles.sessionBadgeFault,
          ]}>
            <View style={styles.sessionStatusRow}>
              <View style={[styles.pulsingDot, !isCharging && styles.statusDotIdle, hasChargerFault && styles.statusDotFault]} />
              <Text style={[styles.liveSessionBadgeText, !isCharging && styles.statusTextIdle, hasChargerFault && styles.statusTextFault]}>
                {statusLabel.toUpperCase()} • Charger {chargerDisplayId} · Connector {telemetry.connectorId}
              </Text>
              <View
                style={[
                  styles.connectionBadge,
                  isConnectionOffline && styles.connectionBadgeOffline,
                  isConnectionDelayed && styles.connectionBadgeDelayed,
                ]}
                accessibilityLabel={`Charger connectivity: ${connectionStatus.toLowerCase()}`}
              >
                <View style={[
                  styles.connectionDot,
                  isConnectionOffline && styles.connectionDotOffline,
                  isConnectionDelayed && styles.connectionDotDelayed,
                ]} />
                <Text style={[
                  styles.connectionBadgeText,
                  isConnectionOffline && styles.connectionBadgeTextOffline,
                  isConnectionDelayed && styles.connectionBadgeTextDelayed,
                ]}>
                  {connectionStatus}
                </Text>
              </View>
            </View>
            {displayStatus.source === 'meter' && (
              <Text style={styles.statusExplanation}>
                {isTelemetryStale ? 'Last reported power indicates charging' : 'Active power is being delivered'}
              </Text>
            )}
          </View>
          <Text style={styles.meterUpdateText}>
            {isUsingMock
              ? 'Sample data'
              : telemetryError
                ? 'Live connection delayed · showing last reading'
                : 'Live data'} · Updated {formatTimestamp(telemetry.meterTimestamp)} (local time)
          </Text>

          {/* Live power is available even when an AC charger cannot report battery SoC. */}
          <View style={styles.tuyaHeroCard}>
            <LivePowerGauge
              powerW={telemetry.totalPowerW}
              maxPowerKw={11}
              active={hasPowerFlow}
              phaseLabel={phaseLabel}
              currentLimitA={configuredCurrentLimitA}
            />
          </View>

          <View style={styles.energySummaryCard}>
            <View style={styles.energySummaryHeader}>
              <View style={styles.energySummaryTitleRow}>
                <Text style={styles.energySummaryIcon}>⚡</Text>
                <Text style={styles.energySummaryLabel}>Energy Delivered</Text>
              </View>
              <View style={styles.liveEnergyBadge}>
                <Text style={styles.liveEnergyBadgeText}>LIVE SESSION</Text>
              </View>
            </View>
            <Text style={styles.energySummaryValue}>
              {formatReading(displayedEnergyWh, 1000, 3)} <Text style={styles.energySummaryUnit}>kWh</Text>
            </Text>
            <Text style={styles.energySummarySub}>Total energy added during this charging session</Text>
          </View>

          <View style={styles.loadBalanceCard}>
            <View style={styles.loadBalanceHeader}>
              <View>
                <Text style={styles.loadBalanceTitle}>Dynamic Load Balancing</Text>
                <Text style={styles.loadBalanceSubtitle}>Building supply and charger allocation</Text>
              </View>
              <View style={[styles.loadBalanceBadge, telemetry.gridLoadW === undefined && styles.loadBalanceBadgeWaiting]}>
                <Text style={[styles.loadBalanceBadgeText, telemetry.gridLoadW === undefined && styles.loadBalanceBadgeTextWaiting]}>
                  {telemetry.gridLoadW === undefined ? 'AWAITING SITE DATA' : 'LIVE'}
                </Text>
              </View>
            </View>
            <View style={styles.loadMetricsRow}>
              <View style={styles.loadMetric}>
                <Text style={styles.loadMetricLabel}>Grid load</Text>
                <Text style={styles.loadMetricValue}>{formatKw(telemetry.gridLoadW)}</Text>
              </View>
              <View style={styles.loadMetricDivider} />
              <View style={styles.loadMetric}>
                <Text style={styles.loadMetricLabel}>Available</Text>
                <Text style={styles.loadMetricValue}>{formatKw(availablePowerW)}</Text>
              </View>
              <View style={styles.loadMetricDivider} />
              <View style={styles.loadMetric}>
                <Text style={styles.loadMetricLabel}>This charger</Text>
                <Text style={styles.loadMetricValue}>{formatKw(telemetry.totalPowerW)}</Text>
              </View>
            </View>
            <View style={styles.loadTrack}>
              {loadUtilizationPercent !== undefined && (
                <View style={[styles.loadTrackFill, { width: `${loadUtilizationPercent}%` }]} />
              )}
            </View>
            <View style={styles.loadBalanceFooter}>
              <Text style={styles.loadBalanceFootnote}>
                {loadUtilizationPercent === undefined
                  ? 'Grid load and site capacity are not reported by the backend yet.'
                  : `${loadUtilizationPercent.toFixed(0)}% of site capacity in use`}
              </Text>
              <Text style={styles.loadLimitText}>{formatReading(activeCurrentLimitA, 1, 0)} A limit</Text>
            </View>
          </View>

          {/* Temporarily replace the Grid → charger → vehicle flow with meter history. */}
          <LiveTelemetryChart
            points={meterHistory}
            sessionStartedAt={liveTelemetry?.transactionStartedAt}
            sessionEndedAt={liveTelemetry?.transactionEventType === 'Ended' ? liveTelemetry.meterTimestamp : undefined}
            isLoading={isHistoryLoading}
            error={historyError}
            isStale={isTelemetryStale || isChargerOffline}
          />

          <View style={styles.advancedCard}>
            <Pressable
              style={styles.advancedToggle}
              onPress={() => setDiagnosticsVisible((visible) => !visible)}
              accessibilityRole="button"
              accessibilityState={{ expanded: diagnosticsVisible }}
            >
              <View>
                <Text style={styles.advancedTitle}>Advanced details</Text>
                <Text style={styles.advancedSubtitle}>Meter, phase and charger diagnostics</Text>
              </View>
              <Text style={styles.advancedToggleIcon}>{diagnosticsVisible ? '−' : '+'}</Text>
            </Pressable>
            {diagnosticsVisible && (
              <View style={styles.advancedContent}>
                <View style={styles.advancedGrid}>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Initial meter reading</Text>
                    <Text style={styles.advancedMetricValue}>{formatReading(telemetry.sessionStartEnergyWh, 1000, 3)} kWh</Text>
                  </View>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Current cumulative</Text>
                    <Text style={styles.advancedMetricValue}>{formatReading(telemetry.totalEnergyWh, 1000, 3)} kWh</Text>
                  </View>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Reported session energy</Text>
                    <Text style={styles.advancedMetricValue}>{formatReading(telemetry.energyDeliveredWh, 1000, 3)} kWh</Text>
                  </View>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Calculated session energy</Text>
                    <Text style={styles.advancedMetricValue}>{formatReading(calculatedEnergyDeliveredWh, 1000, 3)} kWh</Text>
                  </View>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Reported power</Text>
                    <Text style={styles.advancedMetricValue}>{formatKw(telemetry.totalPowerW)}</Text>
                  </View>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Calculated phase total</Text>
                    <Text style={styles.advancedMetricValue}>{formatKw(hasCalculatedPhasePower ? phasePowerTotalW : undefined)}</Text>
                  </View>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Frequency</Text>
                    <Text style={styles.advancedMetricValue}>{formatReading(telemetry.frequencyHz)} Hz</Text>
                  </View>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Temperature</Text>
                    <Text style={styles.advancedMetricValue}>{formatReading(telemetry.temperatureC, 1, 1)} °C</Text>
                  </View>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Applied current limit</Text>
                    <Text style={styles.advancedMetricValue}>{formatReading(telemetry.appliedCurrentLimitA, 1, 0)} A</Text>
                  </View>
                  <View style={styles.advancedMetric}>
                    <Text style={styles.advancedMetricLabel}>Last meter update</Text>
                    <Text style={styles.advancedMetricSmallValue}>{formatTimestamp(telemetry.meterTimestamp)}</Text>
                  </View>
                </View>

                <View style={styles.phaseCardHeader}>
                  <Text style={styles.phaseCardTitle}>L1 / L2 / L3 readings</Text>
                  <Text style={styles.phaseStatusBadge}>{reportedPhases.length} phases reported</Text>
                </View>
                <View style={styles.phaseTableHeader}>
                  <Text style={styles.phaseTableHeading}>Reading</Text>
                  {telemetry.phases.map((phase) => (
                    <Text key={phase.phase} style={styles.phaseColumnHeading}>{phase.phase}</Text>
                  ))}
                </View>
                {PHASE_READING_ROWS.map((row) => (
                  <View key={row.field} style={styles.phaseTableRow}>
                    <Text style={styles.phaseTableLabel}>{row.label} <Text style={styles.phaseTableUnit}>({row.unit})</Text></Text>
                    {telemetry.phases.map((phase) => (
                      <Text
                        key={phase.phase}
                        style={[styles.phaseTableValue, phase[row.field] === undefined && styles.phaseTableMissing]}
                        accessibilityLabel={`${phase.phase} ${row.label}: ${formatReading(phase[row.field], row.divisor, row.decimals)} ${row.unit}`}
                      >
                        {formatReading(phase[row.field], row.divisor, row.decimals)}
                      </Text>
                    ))}
                  </View>
                ))}
                <View style={styles.diagnosticsDetails}>
                  <Text style={styles.diagnosticsText}>Reported state: {telemetry.chargerStatus}</Text>
                  <Text style={styles.diagnosticsText}>Connector: {telemetry.connectorId} · EVSE: {telemetry.evseId ?? 'Not reported'}</Text>
                  <Text style={styles.diagnosticsText}>Error code: {telemetry.chargerErrorCode}</Text>
                  <Text style={styles.diagnosticsText}>— means the charger or backend has not reported that value.</Text>
                </View>
              </View>
            )}
          </View>

        </ScrollView>
      )}

      {activeTab === 'SCHEDULE' && <ParkingScreen vehicle={selectedVehicle} ownerId={user?.mobile ?? null}
        onSelectVehicle={() => setVehiclePickerVisible(true)} />}

      {/* -------------------------------------------------------------
          TAB 3: CHARGE RECORDS (TUYA 03 CHARGE RECORD SCREEN)
      -------------------------------------------------------------- */}
      {activeTab === 'RECORDS' && (
        <ScrollView contentContainerStyle={styles.recordsScrollContent} showsVerticalScrollIndicator={false}>
          <ChargingRecords points={meterHistory} loading={isHistoryLoading} error={historyError} ownerId={user?.mobile ?? null} />
        </ScrollView>
      )}

      {/* -------------------------------------------------------------
          TAB 4: SETTINGS (POWER REGULATION & PROFILE)
      -------------------------------------------------------------- */}
      {activeTab === 'SETTINGS' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.tabHeaderTitle}>Power Regulation & Settings</Text>
          <Text style={styles.tabHeaderSub}>Configure EVSE output & resident preferences</Text>

          {/* Tuya 02/03 Charging Current Regulation */}
          <View style={styles.settingsSectionCard}>
            <Text style={styles.settingCardHeading}>Output Current Regulation</Text>
            <Text style={styles.settingCardSub}>
              Adjust output amperage to protect vehicle battery and reduce building transformer peak load.
            </Text>

            <View style={styles.currentSelectorRow}>
              {[16, 24, 32].map((amp) => (
                <Pressable
                  key={amp}
                  style={[styles.ampButton, configuredCurrentLimitA === amp && styles.ampButtonActive]}
                  onPress={() => {
                    setConfiguredCurrentLimitA(amp);
                    Alert.alert('Demo limit updated', `${amp} A selected. No change has been sent to the charger.`);
                  }}
                >
                  <Text style={[styles.ampButtonText, configuredCurrentLimitA === amp && styles.ampButtonTextActive]}>
                    {amp} A
                  </Text>
                  <Text style={[styles.ampSubText, configuredCurrentLimitA === amp && styles.ampSubTextActive]}>
                    Demo limit
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Resident Profile Details */}
          <View style={styles.settingsSectionCard}>
            <Text style={styles.settingCardHeading}>Resident Account</Text>
            <Text style={styles.profileLine}>Name: <Text style={styles.boldText}>{user?.fullName || 'Nitish'}</Text></Text>
            <Text style={styles.profileLine}>Mobile: <Text style={styles.boldText}>{user?.mobile || '8305763637'}</Text></Text>
            <Text style={styles.profileLine}>Unit: <Text style={styles.boldText}>{user?.flatNumber || 'Tower A - 402'}</Text></Text>
            <Text style={styles.profileLine}>Type: <Text style={styles.boldText}>{user?.residentType || 'OWNER'}</Text></Text>
          </View>

          {/* Logout Action */}
          <Pressable
            style={styles.logoutButton}
            onPress={async () => {
              await logout();
              router.replace('/');
            }}
          >
            <Text style={styles.logoutButtonText}>Sign Out of tBits Plug</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* -------------------------------------------------------------
          BOTTOM 4-TAB BAR (CLEAN & SPACIOUS)
      -------------------------------------------------------------- */}
      {activeTab === 'LIVE' && (
        <Pressable
          style={({ pressed }) => [
            styles.floatingScanButton,
            { bottom: Math.max(insets.bottom, 10) + 58 },
            pressed && styles.floatingScanPressed,
          ]}
          onPress={() => setScanVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Scan to Charge"
          accessibilityHint="View compatible chargers, available slots, or scan a charger QR code"
        >
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Rect x={2} y={2} width={7} height={7} rx={1} fill="none" stroke="#2563EB" strokeWidth={1.7} />
            <Rect x={15} y={2} width={7} height={7} rx={1} fill="none" stroke="#2563EB" strokeWidth={1.7} />
            <Rect x={2} y={15} width={7} height={7} rx={1} fill="none" stroke="#2563EB" strokeWidth={1.7} />
            <Path d="M5 5h1v1H5z M18 5h1v1h-1z M5 18h1v1H5z M12 2v3m0 5v4h4m-4 3v5m3-10h3v3h4m-7 3h3v4m3-4v4M2 12h5m14 0h1" fill="none" stroke="#2563EB" strokeWidth={1.7} />
          </Svg>
          <Text style={styles.floatingScanLabel}>Scan</Text>
        </Pressable>
      )}
      {activeTab === 'LIVE' && hasActiveTransaction && <Pressable
        style={[styles.fixedStopButton, { bottom: Math.max(insets.bottom, 10) + 58 }]}
        onPress={() => setStopChargingModalVisible(true)} accessibilityRole="button"
        accessibilityLabel="End active charging transaction">
        <Text style={styles.fixedStopText}>End Charging</Text>
      </Pressable>}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable style={[styles.tabButton, activeTab === 'LIVE' && styles.tabButtonActive]} onPress={() => setActiveTab('LIVE')}>
          <Text style={[styles.tabIcon, activeTab === 'LIVE' && styles.tabIconActive]}>⚡</Text>
          <Text style={[styles.tabLabel, activeTab === 'LIVE' && styles.tabLabelActive]}>Home</Text>
        </Pressable>

        <Pressable style={[styles.tabButton, activeTab === 'SCHEDULE' && styles.tabButtonActive]} onPress={() => setActiveTab('SCHEDULE')}>
          <Text style={[styles.tabIcon, activeTab === 'SCHEDULE' && styles.tabIconActive]}>🅿️</Text>
          <Text style={[styles.tabLabel, activeTab === 'SCHEDULE' && styles.tabLabelActive]}>Parking</Text>
        </Pressable>

        <Pressable style={[styles.tabButton, activeTab === 'RECORDS' && styles.tabButtonActive]} onPress={() => setActiveTab('RECORDS')}>
          <Text style={[styles.tabIcon, activeTab === 'RECORDS' && styles.tabIconActive]}>📋</Text>
          <Text style={[styles.tabLabel, activeTab === 'RECORDS' && styles.tabLabelActive]}>Records</Text>
        </Pressable>

        <Pressable style={[styles.tabButton, activeTab === 'SETTINGS' && styles.tabButtonActive]} onPress={() => setActiveTab('SETTINGS')}>
          <Text style={[styles.tabIcon, activeTab === 'SETTINGS' && styles.tabIconActive]}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'SETTINGS' && styles.tabLabelActive]}>Settings</Text>
        </Pressable>
      </View>

      <Modal visible={stopChargingModalVisible} transparent animationType="fade" onRequestClose={() => setStopChargingModalVisible(false)}>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.notificationPopup}>
            <Text style={styles.modalHeaderTitle}>End charging?</Text>
            <Text style={styles.demoControlText}>
              This will ask charger {chargerDisplayId} to end transaction {String(telemetry.transactionId ?? '')}.
            </Text>
            <View style={styles.endChargingActions}>
              <Pressable
                style={styles.endChargingCancelBtn}
                onPress={() => setStopChargingModalVisible(false)}
                accessibilityRole="button"
                disabled={isEndingCharging}
              >
                <Text style={styles.endChargingCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.endChargingConfirmBtn, isEndingCharging && styles.buttonDisabled]}
                onPress={() => void handleEndCharging()}
                accessibilityRole="button"
                disabled={isEndingCharging}
              >
                <Text style={styles.endChargingConfirmText}>{isEndingCharging ? 'Sending…' : 'End Charging'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* -------------------------------------------------------------
          MODAL 2: NOTIFICATION CENTER
      -------------------------------------------------------------- */}
      <NotificationCenter
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
        onSelect={setActiveTab}
      />

      <ScanToChargeSheet visible={scanVisible} vehicle={selectedVehicle} onClose={() => setScanVisible(false)}
        onViewSlots={() => { setScanVisible(false); setActiveTab('SCHEDULE'); }} />

      {/* -------------------------------------------------------------
          MODAL 3: VEHICLE SELECTOR
      -------------------------------------------------------------- */}
      <Modal visible={vehiclePickerVisible} transparent animationType="slide" onRequestClose={() => setVehiclePickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.vehiclePickerSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Select vehicle</Text>
                <Text style={styles.vehiclePickerSubtitle}>Choose the EV for charging and reservations</Text>
              </View>
              <Pressable onPress={() => setVehiclePickerVisible(false)} accessibilityLabel="Close vehicle selector">
                <Text style={styles.modalCloseIcon}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.vehiclePickerList} showsVerticalScrollIndicator={false}>
              {vehicles.map((vehicle) => {
                const isSelected = selectedVehicle?.id === vehicle.id;
                return (
                  <Pressable
                    key={vehicle.id}
                    style={[styles.vehiclePickerItem, isSelected && styles.vehiclePickerItemActive]}
                    onPress={() => {
                      selectVehicle(vehicle.id);
                      setVehiclePickerVisible(false);
                    }}
                  >
                    <Text style={styles.vehiclePickerIcon}>{vehicle.icon}</Text>
                    <View style={styles.vehiclePickerInfo}>
                      <Text style={styles.vehiclePickerName}>{vehicle.name}</Text>
                      <Text style={styles.vehiclePickerMeta}>{vehicle.plateNumber} · {vehicle.connectorType}</Text>
                    </View>
                    {isSelected && <Text style={styles.vehiclePickerCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={styles.addVehicleFromPicker}
              onPress={() => {
                setVehiclePickerVisible(false);
                setAddVehicleModalVisible(true);
              }}
            >
              <Text style={styles.addVehicleFromPickerText}>+ Add a vehicle</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* -------------------------------------------------------------
          MODAL 4: ADD NEW VEHICLE
      -------------------------------------------------------------- */}
      <Modal visible={addVehicleModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Add EV to Apartment Garage</Text>
              <Pressable onPress={() => setAddVehicleModalVisible(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>License Plate Number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. MP 04 AB 1234"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              value={newPlateNumber}
              onChangeText={setNewPlateNumber}
            />

            <Text style={styles.inputLabel}>Select Model</Text>
            <ScrollView style={{ maxHeight: 240 }}>
              {POPULAR_EVS.map((ev) => {
                const isSelected = newVehicleModel?.name === ev.name;
                return (
                  <Pressable
                    key={ev.name}
                    style={[styles.catalogItem, isSelected && styles.catalogItemActive]}
                    onPress={() => setNewVehicleModel(ev)}
                  >
                    <Text style={styles.catalogEmoji}>{ev.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catalogName}>{ev.name}</Text>
                      <Text style={styles.catalogSub}>{ev.connectorType} • {ev.batteryCapacityKwh} kWh</Text>
                    </View>
                    {isSelected && <Text style={styles.catalogTick}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.modalPrimaryBtn} onPress={handleSaveVehicle}>
              <Text style={styles.modalPrimaryBtnText}>Save Vehicle</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// STYLES
// -------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  // Top Header
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  brandLogo: { fontSize: 15, fontWeight: '600', color: '#0F172A', letterSpacing: 0.2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileButton: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#E8F0FF', alignItems: 'center', justifyContent: 'center' },
  profileInitials: { color: '#2563EB', fontSize: 11, fontWeight: '600' },
  bellButton: { position: 'relative', padding: 4 },
  bellIcon: { fontSize: 20 },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    width: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetingTitle: { fontSize: 18, fontWeight: '600', color: '#0F172A' },
  greetingSub: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  vehicleHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  vehBadgeEmoji: { fontSize: 18 },
  vehBadgeName: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  vehBadgePlate: { fontSize: 9, color: '#64748B' },
  vehBadgeArrow: { fontSize: 10, color: '#64748B' },

  scrollContent: { padding: 14, paddingBottom: 90 },
  scrollWithScan: { paddingBottom: 150 },
  scrollWithStop: { paddingBottom: 160 },
  recordsScrollContent: { paddingBottom: 80 },

  // Live Telemetry Components (Default Home)
  liveSessionBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  sessionStatusRow: { flexDirection: 'row', alignItems: 'center' },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  connectionBadgeOffline: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  connectionBadgeDelayed: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  connectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  connectionDotOffline: { backgroundColor: '#DC2626' },
  connectionDotDelayed: { backgroundColor: '#D97706' },
  connectionBadgeText: { fontSize: 9, fontWeight: '800', color: '#047857', letterSpacing: 0.2 },
  connectionBadgeTextOffline: { color: '#B91C1C' },
  connectionBadgeTextDelayed: { color: '#92400E' },
  sessionBadgeIdle: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  sessionBadgeFault: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  statusDotFault: { backgroundColor: '#DC2626' },
  statusTextIdle: { color: '#64748B' },
  statusTextFault: { color: '#B91C1C' },
  statusExplanation: { fontSize: 11, color: '#047857', marginTop: 4, marginLeft: 16 },
  meterUpdateText: { fontSize: 11, lineHeight: 16, color: '#64748B' },
  pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 8 },
  liveSessionBadgeText: { flex: 1, fontSize: 11, fontWeight: '800', color: '#065F46', letterSpacing: 0.2 },
  statusDotIdle: { backgroundColor: '#64748B' },

  tuyaHeroCard: { alignItems: 'center', marginVertical: 14 },

  loadBalanceCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  loadBalanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  loadBalanceTitle: { fontSize: 14, fontWeight: '800', color: '#1E3A8A' },
  loadBalanceSubtitle: { fontSize: 10, color: '#64748B', marginTop: 2 },
  loadBalanceBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999 },
  loadBalanceBadgeWaiting: { backgroundColor: '#FEF3C7' },
  loadBalanceBadgeText: { fontSize: 8, fontWeight: '800', color: '#1D4ED8', letterSpacing: 0.3 },
  loadBalanceBadgeTextWaiting: { color: '#92400E' },
  loadMetricsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  loadMetric: { flex: 1, alignItems: 'center' },
  loadMetricDivider: { width: 1, height: 30, backgroundColor: '#BFDBFE' },
  loadMetricLabel: { fontSize: 9, color: '#64748B', marginBottom: 3 },
  loadMetricValue: { fontSize: 14, fontWeight: '800', color: '#0F172A', fontVariant: ['tabular-nums'] },
  loadTrack: { height: 7, borderRadius: 4, backgroundColor: '#DBEAFE', overflow: 'hidden', marginTop: 13 },
  loadTrackFill: { height: '100%', borderRadius: 4, backgroundColor: '#2563EB' },
  loadBalanceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 7 },
  loadBalanceFootnote: { flex: 1, fontSize: 9, lineHeight: 13, color: '#64748B' },
  loadLimitText: { fontSize: 10, fontWeight: '800', color: '#1D4ED8' },

  flowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  flowNode: { alignItems: 'center', flex: 1 },
  flowIcon: { fontSize: 20 },
  flowText: { fontSize: 11, fontWeight: '700', color: '#334155', marginTop: 2 },
  flowLine: { alignItems: 'center', flex: 1.35 },
  flowArrow: { color: '#10B981', fontSize: 10, fontWeight: '800' },
  flowSub: { fontSize: 10, fontWeight: '700', color: '#059669', textAlign: 'center' },

  energySummaryCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  energySummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  energySummaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  energySummaryIcon: { fontSize: 16 },
  energySummaryLabel: { fontSize: 13, fontWeight: '800', color: '#065F46' },
  energySummaryValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: '#064E3B',
    marginTop: 7,
    fontVariant: ['tabular-nums'],
  },
  energySummaryUnit: { fontSize: 17, fontWeight: '800', color: '#047857' },
  energySummarySub: { fontSize: 11, color: '#047857', marginTop: 1 },
  liveEnergyBadge: { backgroundColor: '#D1FAE5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  liveEnergyBadgeText: { fontSize: 9, fontWeight: '800', color: '#047857', letterSpacing: 0.4 },
  unitText: { fontSize: 11, fontWeight: '600', color: '#64748B' },

  phaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  phaseCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  phaseCardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  phaseStatusBadge: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  phaseTableHeader: { flexDirection: 'row', paddingVertical: 8, backgroundColor: '#F8FAFC', borderRadius: 6 },
  phaseTableHeading: { flex: 1.55, fontSize: 11, fontWeight: '700', color: '#64748B', paddingLeft: 4 },
  phaseColumnHeading: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '800', color: '#0F172A', paddingRight: 4 },
  phaseTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  phaseTableLabel: { flex: 1.55, fontSize: 11, fontWeight: '600', color: '#475569', paddingLeft: 4 },
  phaseTableUnit: { fontSize: 10, color: '#64748B' },
  phaseTableValue: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0F172A', textAlign: 'right', paddingRight: 4, fontVariant: ['tabular-nums'] },
  phaseTableMissing: { color: '#94A3B8' },
  diagnosticsToggle: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 13, paddingBottom: 2 },
  diagnosticsToggleText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },
  diagnosticsDetails: { paddingTop: 10, gap: 4 },
  diagnosticsText: { fontSize: 11, lineHeight: 16, color: '#64748B' },

  advancedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  advancedTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  advancedSubtitle: { fontSize: 10, color: '#64748B', marginTop: 2 },
  advancedToggleIcon: { fontSize: 22, color: '#2563EB', fontWeight: '500' },
  advancedContent: { borderTopWidth: 1, borderColor: '#E2E8F0', padding: 12 },
  advancedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  advancedMetric: { width: '48%', backgroundColor: '#F8FAFC', borderRadius: 9, padding: 9, minHeight: 58 },
  advancedMetricLabel: { fontSize: 9, lineHeight: 12, color: '#64748B' },
  advancedMetricValue: { fontSize: 13, lineHeight: 18, fontWeight: '800', color: '#0F172A', marginTop: 3, fontVariant: ['tabular-nums'] },
  advancedMetricSmallValue: { fontSize: 10, lineHeight: 14, fontWeight: '700', color: '#0F172A', marginTop: 3 },

  stopChargingBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopChargingText: { color: '#DC2626', fontSize: 13, fontWeight: '800' },
  stopChargingSubtext: { color: '#991B1B', fontSize: 10, marginTop: 2 },
  demoControlText: { fontSize: 14, color: '#475569', lineHeight: 21, marginTop: 10 },
  endChargingActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  endChargingCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F1F5F9' },
  endChargingCancelText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  endChargingConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#DC2626' },
  endChargingConfirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  buttonDisabled: { opacity: 0.55 },

  // Tab 3 & 4 & 5 Layouts
  tabHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  tabHeaderSub: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  recordCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  recordTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordCharger: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  recordSessionId: { fontSize: 10, color: '#94A3B8' },
  recordEnergyPill: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  recordEnergyText: { color: '#059669', fontSize: 12, fontWeight: '800' },
  recordDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  recordMetaText: { fontSize: 11, color: '#64748B' },

  tabTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addNewVehBtn: { backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addNewVehText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  vehGarageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  vehGarageCardActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  vehGarageIcon: { fontSize: 26, marginRight: 10 },
  vehGarageTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  vehGaragePlate: { fontSize: 11, color: '#64748B' },
  vehGarageSpecs: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  activeCheckPill: { backgroundColor: '#2563EB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeCheckText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  selectVehText: { fontSize: 12, color: '#2563EB', fontWeight: '700' },

  // Settings
  settingsSectionCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  settingCardHeading: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  settingCardSub: { fontSize: 11, color: '#64748B', marginBottom: 12 },
  currentSelectorRow: { flexDirection: 'row', gap: 8 },
  ampButton: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
  ampButtonActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  ampButtonText: { fontSize: 15, fontWeight: '800', color: '#334155' },
  ampButtonTextActive: { color: '#059669' },
  ampSubText: { fontSize: 10, color: '#94A3B8' },
  ampSubTextActive: { color: '#10B981' },
  profileLine: { fontSize: 12, color: '#64748B', marginVertical: 3 },
  boldText: { color: '#0F172A', fontWeight: '700' },
  logoutButton: { backgroundColor: '#FEE2E2', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  logoutButtonText: { color: '#DC2626', fontSize: 13, fontWeight: '800' },

  // Bottom 5-Tab Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    elevation: 8,
  },
  tabButton: { alignItems: 'center', justifyContent: 'center', minWidth: 60, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 11 },
  tabButtonActive: { backgroundColor: '#EFF5FF' },
  tabIcon: { fontSize: 18, color: '#94A3B8' },
  tabIconActive: { color: '#2563EB' },
  tabLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', marginTop: 2 },
  tabLabelActive: { color: '#2563EB', fontWeight: '600' },
  fixedStopButton: { position: 'absolute', left: 16, right: 94, zIndex: 5, backgroundColor: '#E7EDF8', borderWidth: 1, borderColor: '#CFD9EA', borderRadius: 11, alignItems: 'center', paddingVertical: 12 },
  floatingScanButton: {
    position: 'absolute', right: 16, width: 64, height: 64, zIndex: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#D7E5FA',
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 3,
    boxShadow: '0px 3px 10px rgba(37, 99, 235, 0.12)', elevation: 4,
  },
  floatingScanPressed: { backgroundColor: '#EFF6FF' },
  floatingScanLabel: { fontSize: 10, fontWeight: '500', color: '#2563EB' },
  fixedStopText: { color: '#23406E', fontSize: 13, fontWeight: '600' },

  // Vehicle selector
  vehiclePickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 30,
  },
  vehiclePickerSubtitle: { fontSize: 11, color: '#64748B', marginTop: 3 },
  vehiclePickerList: { maxHeight: 280 },
  vehiclePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  vehiclePickerItemActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  vehiclePickerIcon: { fontSize: 25, marginRight: 10 },
  vehiclePickerInfo: { flex: 1 },
  vehiclePickerName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  vehiclePickerMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  vehiclePickerCheck: { color: '#2563EB', fontSize: 18, fontWeight: '800' },
  addVehicleFromPicker: {
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  addVehicleFromPickerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  calendarModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 30 },
  modalHandle: { width: 36, height: 4, backgroundColor: '#CBD5E1', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalCloseIcon: { fontSize: 16, color: '#64748B', padding: 4 },
  modalPrimaryBtn: { backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 14 },
  modalPrimaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  notificationPopup: { backgroundColor: '#FFFFFF', width: '85%', borderRadius: 16, padding: 16 },

  inputLabel: { fontSize: 11, fontWeight: '700', color: '#334155', marginTop: 10, marginBottom: 4 },
  textInput: { height: 44, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#0F172A' },
  catalogItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginBottom: 6 },
  catalogItemActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  catalogEmoji: { fontSize: 20, marginRight: 8 },
  catalogName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  catalogSub: { fontSize: 10, color: '#64748B' },
  catalogTick: { color: '#2563EB', fontSize: 14, fontWeight: '800' },
});
