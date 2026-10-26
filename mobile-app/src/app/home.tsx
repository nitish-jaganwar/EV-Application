import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { toNotificationData } from '@/services/notifications/notificationEvents';
import { useVehicle } from '@/context/VehicleContext';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import ChargingRecords from '@/components/ChargingRecords';
import ScanToChargeSheet from '@/features/booking/ScanToChargeSheet';
import { useChargerTelemetry } from '@/hooks/use-charger-telemetry';
import { useChargerHistory } from '@/hooks/use-charger-history';
import { startChargingTransaction, stopChargingTransaction } from '@/services/chargerApi';
import {
  APARTMENT_CHARGERS,
  ChargerItem,
} from '@/services/chargerInventory';
import { fetchLiveApartmentChargersFromHasura } from '@/services/hasuraClient';
import { fetchActiveTariff, DEFAULT_TARIFF, type TariffInfo } from '@/services/tariffService';
import EngineeringDiagnosticsModal from '@/components/modals/EngineeringDiagnosticsModal';
import {
  HomeIcon,
  RecordsIcon,
  ProfileIcon,
  BellIcon,
  BoltIcon,
  StopIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  FlagIcon,
  QrCodeIcon,
  ClockIcon,
  CalendarIcon,
  InfoIcon,
} from '@/components/ui/AppIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { vehicles, selectedVehicle, selectVehicle } = useVehicle();
  const { unreadCount, receiveNotification } = useNotifications();

  // Navigation tab: 'HOME' | 'RECORDS' | 'PROFILE'
  const [activeTab, setActiveTab] = useState<'HOME' | 'RECORDS' | 'PROFILE'>('HOME');

  // Filter for chargers
  const [filterType, setFilterType] = useState<'ALL' | 'AVAILABLE' | 'COMPATIBLE'>('ALL');
  const [chargers, setChargers] = useState<ChargerItem[]>(APARTMENT_CHARGERS);
  const [hasuraLiveStatus, setHasuraLiveStatus] = useState<'CONNECTED' | 'STANDBY'>('STANDBY');
  const [limitWarningModalVisible, setLimitWarningModalVisible] = useState(false);

  // Modals & Sheets
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [vehiclePickerVisible, setVehiclePickerVisible] = useState(false);
  const [startChargeModalVisible, setStartChargeModalVisible] = useState(false);
  const [selectedChargerForBooking, setSelectedChargerForBooking] = useState<ChargerItem | null>(null);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [liveTariff, setLiveTariff] = useState<TariffInfo>(DEFAULT_TARIFF);
  const [diagnosticsModalVisible, setDiagnosticsModalVisible] = useState(false);

  // Custom Branded Dialog Modals State (replacing raw OS alerts)
  const [sessionStartedModalVisible, setSessionStartedModalVisible] = useState(false);
  const [stopConfirmModalVisible, setStopConfirmModalVisible] = useState(false);
  const [sessionSummaryModalVisible, setSessionSummaryModalVisible] = useState(false);
  const [completedSessionData, setCompletedSessionData] = useState<{
    deliveredKwh: number;
    totalBill: string;
    chargerName: string;
    bayNumber: string;
    durationMins: number;
  } | null>(null);
  const [reservationConfirmedModalVisible, setReservationConfirmedModalVisible] = useState(false);
  const [confirmedReservationData, setConfirmedReservationData] = useState<{
    chargerName: string;
    slotTime: string;
    rate: number;
    savings: number;
  } | null>(null);

  // Start Charging Sheet State
  const [chargingMode, setChargingMode] = useState<'WALK_IN' | 'RESERVE'>('WALK_IN');
  const [requestedKwh, setRequestedKwh] = useState<number>(15);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('Today, 04:00 PM - 05:30 PM');

  // Active Live Charging Session State (Mock or Real)
  const [isChargingActive, setIsChargingActive] = useState<boolean>(false);
  const [activeSessionCharger, setActiveSessionCharger] = useState<ChargerItem | null>(null);
  const [deliveredKwh, setDeliveredKwh] = useState<number>(4.2);
  const [targetKwh, setTargetKwh] = useState<number>(15);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(1140); // ~19 mins

  // Telemetry hook
  const { telemetry: liveTelemetry, refresh: refreshTelemetry, clearActiveSession } = useChargerTelemetry();
  const { points: meterHistory, isLoading: isHistoryLoading, error: historyError } = useChargerHistory(liveTelemetry);

  // Guards against race conditions, duplicate stops, and stale telemetry snapshots
  const userStoppedSessionRef = useRef(false);
  const isStoppingInProgressRef = useRef(false);

  // Auto-sync active charging hero with live hardware telemetry from CitrineOS / EVerest
  useEffect(() => {
    // If the user actively stopped the session, keep charging inactive until a new session starts
    if (userStoppedSessionRef.current) {
      if (!liveTelemetry?.transactionId || liveTelemetry.chargerStatus !== 'Charging') {
        userStoppedSessionRef.current = false;
      }
      setIsChargingActive(false);
      return;
    }

    if (liveTelemetry && liveTelemetry.chargerStatus === 'Charging' && liveTelemetry.transactionId) {
      setIsChargingActive(true);
      const matched = chargers.find((c) => c.id.startsWith(liveTelemetry.chargerId || 'cp001')) || chargers[0];
      if (matched) {
        setActiveSessionCharger({
          ...matched,
          powerKw: liveTelemetry.totalPowerW
            ? Number((liveTelemetry.totalPowerW / 1000).toFixed(1))
            : matched.powerKw,
        });
      }
      if (typeof liveTelemetry.energyDeliveredWh === 'number' && liveTelemetry.energyDeliveredWh > 0) {
        const kwh = Number((liveTelemetry.energyDeliveredWh / 1000).toFixed(3));
        setDeliveredKwh((prev) => Math.max(prev, kwh));
      }
      if (typeof liveTelemetry.chargingSeconds === 'number' && liveTelemetry.chargingSeconds > 0) {
        setElapsedSeconds((prev) => Math.max(prev, liveTelemetry.chargingSeconds!));
      }
    } else if (liveTelemetry && (!liveTelemetry.transactionId || liveTelemetry.chargerStatus !== 'Charging')) {
      if (isChargingActive) {
        setIsChargingActive(false);
      }
    }
  }, [liveTelemetry, chargers, isChargingActive]);

  // Pulse animation for dynamic charging hero
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isChargingActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      pulse.start();
      rotate.start();

      // Timer to increment elapsed time
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      return () => {
        pulse.stop();
        rotate.stop();
        clearInterval(timer);
      };
    }
  }, [isChargingActive, pulseAnim, rotateAnim]);

  // Sync real hardware energy & elapsed seconds from live telemetry (monotonic forward)
  useEffect(() => {
    if (isChargingActive && liveTelemetry) {
      if (typeof liveTelemetry.energyDeliveredWh === 'number' && liveTelemetry.energyDeliveredWh > 0) {
        const kwh = Number((liveTelemetry.energyDeliveredWh / 1000).toFixed(3));
        setDeliveredKwh((prev) => Math.max(prev, kwh));
      }
      if (typeof liveTelemetry.chargingSeconds === 'number' && liveTelemetry.chargingSeconds > 0) {
        setElapsedSeconds((prev) => Math.max(prev, liveTelemetry.chargingSeconds!));
      }
    }
  }, [isChargingActive, liveTelemetry]);

  // Live Sync with CitrineOS & Hasura GraphQL fleet
  useEffect(() => {
    let isMounted = true;
    const syncLiveFleet = async () => {
      try {
        const liveItems = await fetchLiveApartmentChargersFromHasura();
        if (isMounted) {
          if (liveItems && liveItems.length > 0) {
            setChargers(liveItems);
            setHasuraLiveStatus('CONNECTED');
          } else {
            setHasuraLiveStatus('STANDBY');
          }
        }
      } catch {
        if (isMounted) setHasuraLiveStatus('STANDBY');
      }
    };

    syncLiveFleet();
    fetchActiveTariff().then(setLiveTariff).catch(() => {});
    const interval = setInterval(() => {
      syncLiveFleet();
      fetchActiveTariff().then(setLiveTariff).catch(() => {});
    }, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Format Elapsed Time
  const formattedElapsedTime = useMemo(() => {
    const hrs = Math.floor(elapsedSeconds / 3600);
    const mins = Math.floor((elapsedSeconds % 3600) / 60);
    const secs = elapsedSeconds % 60;
    return `${hrs > 0 ? `${hrs}h ` : ''}${mins < 10 ? `0${mins}` : mins}m ${secs < 10 ? `0${secs}` : secs}s`;
  }, [elapsedSeconds]);

  // Filtered Chargers
  const filteredChargers = useMemo(() => {
    return chargers.filter((charger) => {
      if (filterType === 'AVAILABLE') return charger.status === 'AVAILABLE';
      if (filterType === 'COMPATIBLE') {
        if (!selectedVehicle) return true;
        return charger.connectorType === selectedVehicle.connectorType;
      }
      return true;
    });
  }, [chargers, filterType, selectedVehicle]);

  // Handle open Start Charging Modal
  const handleOpenStartCharging = (charger: ChargerItem) => {
    if (isChargingActive && charger.status === 'AVAILABLE') {
      setLimitWarningModalVisible(true);
      return;
    }
    setSelectedChargerForBooking(charger);
    setChargingMode('WALK_IN');
    setStartChargeModalVisible(true);
  };

  // Confirm Immediate Walk-in Charging (Fair-use single session enforcement)
  const handleConfirmImmediateCharging = async () => {
    if (!selectedChargerForBooking) return;
    if (isChargingActive) {
      setStartChargeModalVisible(false);
      setLimitWarningModalVisible(true);
      return;
    }
    const charger = selectedChargerForBooking;
    const chargerCode = charger.id.split('_')[0] || 'cp001';

    // Verify charger is not offline
    if (charger.status === 'OFFLINE') {
      Alert.alert(
        'Charger Offline',
        `Station ${charger.name} is currently offline. Please choose an available bay.`
      );
      return;
    }

    setStartChargeModalVisible(false);
    userStoppedSessionRef.current = false;
    isStoppingInProgressRef.current = false;

    try {
      // Trigger RemoteStart on CitrineOS via OCPP 1.6
      const started = await startChargingTransaction(chargerCode, 'FLAT_A402_NITISH', 1);

      if (!started) {
        Alert.alert(
          'Unable to Start Session',
          `Station ${charger.name} (${chargerCode}) could not start charging. Please verify that your EV cable is firmly plugged in and that the bay is available.`
        );
        return;
      }

      // Notify user: Charging Started
      receiveNotification(toNotificationData({
        id: `started-${Date.now()}`,
        recipientId: user?.mobile || '8305763637',
        type: 'charging_started',
        title: '⚡ Charging started',
        body: `Your charging session at ${charger.name} has started at ${charger.powerKw} kW speed.`,
        createdAt: new Date().toISOString(),
        destination: 'LIVE',
        demo: false,
        read: false,
      }));

      setActiveSessionCharger(charger);
      setTargetKwh(requestedKwh);
      setDeliveredKwh(0.0);
      setElapsedSeconds(0);
      setIsChargingActive(true);
      setSessionStartedModalVisible(true);
    } catch (err) {
      Alert.alert('Connection Error', 'Network timeout while contacting the charging station.');
    }
  };

  // Confirm Reservation Booking
  const handleConfirmReservation = () => {
    if (!selectedChargerForBooking) return;
    setStartChargeModalVisible(false);
    setConfirmedReservationData({
      chargerName: selectedChargerForBooking.name,
      slotTime: selectedSlotTime,
      rate: selectedChargerForBooking.reservationRatePerKwh,
      savings:
        selectedChargerForBooking.walkInRatePerKwh -
        selectedChargerForBooking.reservationRatePerKwh,
    });
    setReservationConfirmedModalVisible(true);
  };

  // Stop Charging Action (opens custom modal)
  const handleStopCharging = () => {
    setStopConfirmModalVisible(true);
  };

  // Execute Stop Charging from custom modal
  const handleExecuteStopSession = async () => {
    if (isStoppingInProgressRef.current) return;
    isStoppingInProgressRef.current = true;
    userStoppedSessionRef.current = true;

    setStopConfirmModalVisible(false);
    setIsChargingActive(false);
    clearActiveSession();

    try {
      await stopChargingTransaction(
        liveTelemetry?.chargerId || 'cp001',
        liveTelemetry?.transactionId || 1,
        liveTelemetry?.connectorId || 1,
        liveTelemetry?.evseId
      );
    } catch (err) {
      console.warn('Failed to send stop command to Citrine:', err);
    } finally {
      refreshTelemetry();
      isStoppingInProgressRef.current = false;
    }

    const totalBill = (
      deliveredKwh * liveTariff.pricePerKwh
    ).toFixed(2);
    setCompletedSessionData({
      deliveredKwh: Number(deliveredKwh.toFixed(2)),
      totalBill,
      chargerName: activeSessionCharger?.name || 'tBits Bay 01',
      bayNumber: activeSessionCharger?.bayNumber || 'Bay 01',
      durationMins: Math.max(1, Math.round(elapsedSeconds / 60)),
    });

    // 1. Session Ended Notification (sent exactly once per session termination)
    receiveNotification(toNotificationData({
      id: `ended-${Date.now()}`,
      recipientId: user?.mobile || '8305763637',
      type: 'session_ended',
      title: '✅ Charging session ended',
      body: `Your session at ${activeSessionCharger?.name || 'tBits Bay 01'} has ended. Energy delivered: ${deliveredKwh.toFixed(2)} kWh. Bill: ₹${totalBill}.`,
      createdAt: new Date().toISOString(),
      destination: 'RECORDS',
      demo: false,
      read: false,
    }));

    // 2. Unplug & Overstay Reminder Notification
    receiveNotification(toNotificationData({
      id: `unplug-${Date.now() + 1}`,
      recipientId: user?.mobile || '8305763637',
      type: 'unplug_reminder',
      title: '⚠️ Please free the charging space',
      body: `Your session at ${activeSessionCharger?.name || 'tBits Bay 01'} has ended and the vehicle is still connected. Please unplug your cable to avoid overstay fees.`,
      createdAt: new Date().toISOString(),
      destination: 'LIVE',
      demo: false,
      read: false,
    }));

    setSessionSummaryModalVisible(true);
  };

  // Calculate costs with live Citrine tariff
  const activeRate = liveTariff.pricePerKwh;
  const estimatedCost = (requestedKwh * activeRate).toFixed(2);
  const walkInTotal = estimatedCost;
  const reservationTotal = estimatedCost;
  const potentialSavings = '0';

  // Summary counts for network overview
  const availableCount = useMemo(() => chargers.filter((c) => c.status === 'AVAILABLE').length, [chargers]);
  const occupiedCount = useMemo(() => chargers.filter((c) => c.status === 'OCCUPIED').length, [chargers]);
  const offlineCount = useMemo(() => chargers.filter((c) => c.status === 'OFFLINE').length, [chargers]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* -------------------------------------------------------------
          TOP BAR (GREETING + VEHICLE PILL + BELL)
      -------------------------------------------------------------- */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BoltIcon size={20} color="#2563EB" />
            <Text style={styles.brandLogo}>tBits Plug</Text>
          </View>
          <View style={styles.headerRightActions}>
            <Pressable
              style={styles.bellButton}
              onPress={() => setNotificationModalVisible(true)}
              accessibilityLabel="Notifications"
            >
              <BellIcon size={19} color="#475569" />
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.profileAvatar}
              onPress={() => setActiveTab('PROFILE')}
            >
              <Text style={styles.profileAvatarText}>
                {user?.fullName?.slice(0, 1).toUpperCase() || 'N'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Welcome Greeting Row */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingTitle}>
              Hi, {user?.fullName?.split(' ')[0] || 'Nitish'}! 👋
            </Text>
            <Text style={styles.greetingSubtitle}>
              {user?.flatNumber || user?.block ? `${user.block} - ${user.apartmentNumber}` : 'Tower A - 402'} • Resident
            </Text>
          </View>

          {/* Quick Vehicle Switcher Badge */}
          <Pressable
            style={styles.vehicleHeaderPill}
            onPress={() => setVehiclePickerVisible(true)}
          >
            <Text style={styles.vehiclePillEmoji}>
              {selectedVehicle?.icon || '🚗'}
            </Text>
            <View style={styles.vehiclePillTextCol}>
              <Text style={styles.vehiclePillName} numberOfLines={1}>
                {selectedVehicle?.name || 'Select EV'}
              </Text>
              <Text style={styles.vehiclePillPlate}>
                {selectedVehicle?.plateNumber || 'Add Plate'}
              </Text>
            </View>
            <Text style={styles.vehiclePillArrow}>▾</Text>
          </Pressable>
        </View>
      </View>

      {/* -------------------------------------------------------------
          MAIN TAB CONTENT
      -------------------------------------------------------------- */}
      {activeTab === 'HOME' && (
        <ScrollView
          contentContainerStyle={[styles.mainScroll, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* =========================================================
              PART 3 & 4: DYNAMIC LIVE CHARGING HERO (WHEN ACTIVE)
          ========================================================== */}
          {isChargingActive ? (
            <View style={styles.liveHeroCard}>
              <View style={styles.liveHeroTop}>
                <View style={styles.liveHeroTagRow}>
                  <View style={styles.liveGreenDot} />
                  <Text style={styles.liveHeroTagText}>CHARGING IN PROGRESS</Text>
                </View>
                <Text style={styles.liveHeroBay} numberOfLines={1} ellipsizeMode="tail">
                  {activeSessionCharger?.bayNumber || 'Bay 01'} · {activeSessionCharger?.powerKw || 11} kW
                </Text>
              </View>

              {/* Animated Progress Gauge */}
              <View style={styles.gaugeContainer}>
                <Animated.View
                  style={[
                    styles.gaugePulseRing,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={styles.gaugeCenterDisc}>
                  <Text style={styles.gaugeBigEnergy}>{deliveredKwh.toFixed(2)}</Text>
                  <Text style={styles.gaugeUnit}>kWh delivered</Text>
                  <View style={styles.gaugePowerTag}>
                    <BoltIcon size={12} color="#0284C7" />
                    <Text style={styles.gaugePowerText}>
                      {activeSessionCharger?.powerKw || 11} kW Speed
                    </Text>
                  </View>
                  {Boolean(liveTelemetry?.phases?.[0]?.voltageV) && (
                    <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600', marginTop: 4 }}>
                      {liveTelemetry?.phases?.[0]?.voltageV}V · {liveTelemetry?.phases?.[0]?.currentA || 16}A AC Line
                    </Text>
                  )}
                </View>
              </View>

              {/* Progress Bar towards Target */}
              <View style={styles.progressBarWrapper}>
                <View style={styles.progressBarLabels}>
                  <Text style={styles.progressLabel}>
                    Target: {targetKwh} kWh
                  </Text>
                  <Text style={styles.progressPercent}>
                    {Math.min(100, Math.round((deliveredKwh / targetKwh) * 100))}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, Math.round((deliveredKwh / targetKwh) * 100))}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Real-time Session Metrics */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Time Elapsed</Text>
                  <Text style={styles.metricVal}>{formattedElapsedTime}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Est. Remaining</Text>
                  <Text style={styles.metricVal}>
                    ~{Math.max(0, Math.round(((targetKwh - deliveredKwh) / (activeSessionCharger?.powerKw || 11)) * 60))} min
                  </Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Current Cost</Text>
                  <Text style={styles.metricValCost}>
                    ₹{(deliveredKwh * liveTariff.pricePerKwh).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Stop Charging CTA */}
              <Pressable
                style={styles.stopChargingBtn}
                onPress={handleStopCharging}
              >
                <StopIcon size={16} color="#DC2626" />
                <Text style={styles.stopChargingBtnText}>Stop Charging</Text>
              </Pressable>
            </View>
          ) : (
            /* =========================================================
                PART 1: 3-STEP GUIDE ICONS (BEFORE CHARGING)
            ========================================================== */
            <View style={styles.guideCard}>
              <Text style={styles.guideHeading}>How to Charge at Apartment</Text>
              <View style={styles.stepsRow}>
                <View style={styles.stepItem}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepNumber}>1</Text>
                  </View>
                  <Text style={styles.stepTitle}>Pick Charger</Text>
                  <Text style={styles.stepSub}>Select free bay</Text>
                </View>

                <View style={styles.stepArrow}>
                  <Text style={styles.arrowText}>→</Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepNumber}>2</Text>
                  </View>
                  <Text style={styles.stepTitle}>Choose Mode</Text>
                  <Text style={styles.stepSub}>Walk-in or Reserve</Text>
                </View>

                <View style={styles.stepArrow}>
                  <Text style={styles.arrowText}>→</Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepNumber}>3</Text>
                  </View>
                  <Text style={styles.stepTitle}>Scan & Plug In</Text>
                  <Text style={styles.stepSub}>Instant electricity</Text>
                </View>
              </View>
            </View>
          )}

          {/* =========================================================
              PART 1: CHARGER LISTING HEADER & FILTERS
          ========================================================== */}
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <Text style={styles.sectionTitle}>Apartment Parking Chargers</Text>
                <Pressable
                  onPress={() => setDiagnosticsModalVisible(true)}
                  style={[styles.hasuraSyncBadge, hasuraLiveStatus === 'CONNECTED' ? styles.badgeGreen : styles.badgeMuted]}
                >
                  <View style={[styles.pulseDot, hasuraLiveStatus === 'CONNECTED' ? styles.pulseDotGreen : styles.pulseDotMuted]} />
                  <Text style={[styles.hasuraSyncText, hasuraLiveStatus === 'CONNECTED' ? styles.textGreen : styles.textMuted]}>
                    {hasuraLiveStatus === 'CONNECTED' ? 'Live Network' : 'Standby'}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.sectionSub}>
                {availableCount} Available · {occupiedCount} In Use · {offlineCount} Offline
              </Text>
            </View>
          </View>

          {/* Filter Chips */}
          <View style={styles.filterRow}>
            <Pressable
              style={[
                styles.filterChip,
                filterType === 'ALL' && styles.filterChipActive,
              ]}
              onPress={() => setFilterType('ALL')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterType === 'ALL' && styles.filterChipTextActive,
                ]}
              >
                All Chargers ({chargers.length})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterChip,
                filterType === 'AVAILABLE' && styles.filterChipActive,
              ]}
              onPress={() => setFilterType('AVAILABLE')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterType === 'AVAILABLE' && styles.filterChipTextActive,
                ]}
              >
                Available Only
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterChip,
                filterType === 'COMPATIBLE' && styles.filterChipActive,
              ]}
              onPress={() => setFilterType('COMPATIBLE')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterType === 'COMPATIBLE' && styles.filterChipTextActive,
                ]}
              >
                Matches My {selectedVehicle?.type || 'EV'}
              </Text>
            </Pressable>
          </View>

          {/* Charger Cards List */}
          <View style={styles.chargerList}>
            {filteredChargers.map((charger, index) => {
              const isAvailable = charger.status === 'AVAILABLE';
              const isOccupied = charger.status === 'OCCUPIED';
              const isReserved = charger.status === 'RESERVED';
              const isCompatible =
                selectedVehicle?.connectorType === charger.connectorType;

              return (
                <View key={`${charger.id}_${index}`} style={styles.chargerCard}>
                  {/* Card Header (Streamlined 2-Tier Header, Zero Overlap) */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.chargerMetaCol}>
                      <Text style={styles.chargerName} numberOfLines={1} ellipsizeMode="tail">
                        {charger.name}
                      </Text>
                      <Text style={styles.chargerSubDetail}>
                        {charger.bayNumber} · {charger.powerKw} kW {charger.powerType} · {charger.connectorType}
                      </Text>
                    </View>

                    {/* Status Pill */}
                    <View
                      style={[
                        styles.statusPill,
                        isAvailable && styles.statusAvailable,
                        isOccupied && styles.statusOccupied,
                        isReserved && styles.statusReserved,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          isAvailable && styles.statusDotAvailable,
                          isOccupied && styles.statusDotOccupied,
                          isReserved && styles.statusDotReserved,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          isAvailable && styles.statusTextAvailable,
                          isOccupied && styles.statusTextOccupied,
                          isReserved && styles.statusTextReserved,
                        ]}
                      >
                        {isAvailable ? 'AVAILABLE' : isOccupied ? 'PLUGGED IN' : isReserved ? 'RESERVED' : 'OFFLINE'}
                      </Text>
                    </View>
                  </View>

                  {/* Compatibility Badge */}
                  {isCompatible && (
                    <View style={styles.compatibleBanner}>
                      <Text style={styles.compatibleText}>
                        ✓ Fits your {selectedVehicle?.name} ({selectedVehicle?.connectorType})
                      </Text>
                    </View>
                  )}

                  {/* Live Citrine Tariff Row */}
                  <View style={styles.minimalPricingBox}>
                    <View style={styles.minimalPriceCol}>
                      <Text style={styles.minimalPriceLabel}>Society EV Tariff</Text>
                      <Text style={styles.minimalPriceVal}>
                        ₹{liveTariff.pricePerKwh.toFixed(2)}
                        <Text style={styles.minimalPriceUnit}> / kWh</Text>
                      </Text>
                    </View>

                    <View style={styles.minimalPriceDivider} />

                    <View style={styles.minimalPriceCol}>
                      <View style={styles.minimalSaveRow}>
                        <Text style={styles.minimalPriceLabel}>Society Billing</Text>
                        <View style={styles.citrineVerifiedBadge}>
                          <Text style={styles.citrineVerifiedText}>Verified</Text>
                        </View>
                      </View>
                      <Text style={styles.minimalPriceValGreen}>
                        Post-Paid Ledger
                      </Text>
                    </View>
                  </View>

                  {/* Footer Action */}
                  <View style={styles.cardFooter}>
                    {isOccupied && charger.estimatedAvailableTime ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <ClockIcon size={13} color="#D97706" />
                        <Text style={styles.occupiedEstimate}>
                          Free in {charger.estimatedAvailableTime}
                        </Text>
                      </View>
                    ) : (
                      <View />
                    )}

                    <Pressable
                      style={[
                        styles.actionBtn,
                        (isAvailable || isOccupied) ? styles.actionBtnStart : styles.actionBtnReserve,
                      ]}
                      onPress={() => handleOpenStartCharging(charger)}
                    >
                      {(isAvailable || isOccupied) ? (
                        <BoltIcon size={14} color="#FFFFFF" />
                      ) : (
                        <CalendarIcon size={14} color="#FFFFFF" />
                      )}
                      <Text
                        style={[
                          styles.actionBtnText,
                          (isAvailable || isOccupied) ? styles.actionBtnTextStart : styles.actionBtnTextReserve,
                        ]}
                      >
                        {isAvailable ? 'Start Charging' : isOccupied ? 'Plugged In · Start' : 'Reserve Slot'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* -------------------------------------------------------------
          TAB 2: RECORDS
      -------------------------------------------------------------- */}
      {activeTab === 'RECORDS' && (
        <ScrollView contentContainerStyle={styles.mainScroll} showsVerticalScrollIndicator={false}>
          <ChargingRecords
            points={meterHistory}
            loading={isHistoryLoading}
            error={historyError}
            ownerId={'FLAT_A402_NITISH'}
          />
        </ScrollView>
      )}

      {/* -------------------------------------------------------------
          TAB 3: PROFILE HUB
      -------------------------------------------------------------- */}
      {activeTab === 'PROFILE' && (
        <ScrollView
          contentContainerStyle={[styles.mainScroll, { paddingBottom: 110 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Resident Identity Card */}
          <View style={styles.profileHeroCard}>
            <View style={styles.profileHeroHeader}>
              <View style={styles.profileAvatarLarge}>
                <Text style={styles.profileAvatarLargeText}>
                  {user?.fullName?.slice(0, 1).toUpperCase() || 'N'}
                </Text>
              </View>
              <View style={styles.profileNameCol}>
                <Text style={styles.profileFullName}>
                  {user?.fullName || 'Nitish Jaganwar'}
                </Text>
                <Text style={styles.profileSubInfo}>
                  {user?.flatNumber || (user?.block ? `${user.block} - ${user.apartmentNumber}` : 'Tower A - 402')}
                </Text>
                <View style={styles.residentBadge}>
                  <Text style={styles.residentBadgeText}>
                    {user?.residentType === 'TENANT' ? 'Apartment Tenant' : 'Apartment Owner'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.profileContactDivider} />
            <View style={styles.profileContactRow}>
              <Text style={styles.profileContactLabel}>Registered Mobile</Text>
              <Text style={styles.profileContactValue}>{user?.mobile || '+91 83057 63637'}</Text>
            </View>
          </View>

          {/* My EV Garage Card */}
          <View style={styles.profileSectionCard}>
            <View style={styles.profileSectionHeader}>
              <Text style={styles.profileSectionTitle}>My EV Garage</Text>
              <Pressable
                style={styles.switchVehInlineBtn}
                onPress={() => setVehiclePickerVisible(true)}
              >
                <Text style={styles.switchVehInlineText}>Switch / Add</Text>
              </Pressable>
            </View>

            <View style={styles.garageVehicleRow}>
              <Text style={styles.garageVehicleEmoji}>{selectedVehicle?.icon || '🚗'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.garageVehicleName}>
                  {selectedVehicle?.name || 'Tata Nexon EV'}
                </Text>
                <Text style={styles.garageVehiclePlate}>
                  {selectedVehicle?.plateNumber || 'MP 04 AB 1234'} • {selectedVehicle?.connectorType || 'CCS2'}
                </Text>
              </View>
              <View style={styles.garageBatteryPill}>
                <Text style={styles.garageBatteryText}>
                  {selectedVehicle?.batteryCapacityKwh || 40.5} kWh
                </Text>
              </View>
            </View>
          </View>

          {/* Society EV Tariff Policy Card */}
          <View style={styles.profileSectionCard}>
            <View style={styles.profileSectionHeader}>
              <Text style={styles.profileSectionTitle}>Society EV Tariff Policy</Text>
              <View style={styles.citrineVerifiedBadge}>
                <Text style={styles.citrineVerifiedText}>Standard Rate</Text>
              </View>
            </View>
            <Text style={styles.profileSectionSub}>
              Approved by Society EV Committee
            </Text>

            <View style={styles.tariffPolicyGrid}>
              <View style={styles.tariffPolicyCol}>
                <Text style={styles.tariffPolicyLabel}>Active Society Rate</Text>
                <Text style={styles.tariffPolicyVal}>₹{liveTariff.pricePerKwh.toFixed(2)} <Text style={styles.tariffUnit}>/ kWh</Text></Text>
                <Text style={styles.tariffPolicyDesc}>RWA Standard Tariff</Text>
              </View>
              <View style={styles.tariffPolicyDivider} />
              <View style={styles.tariffPolicyCol}>
                <Text style={styles.tariffPolicyLabel}>Billing Method</Text>
                <Text style={styles.tariffPolicyValGreen}>Post-Paid</Text>
                <Text style={styles.tariffPolicyDescDiscount}>Billed to Flat A-402</Text>
              </View>
            </View>

            <View style={styles.policyLedgerNotice}>
              <Text style={styles.policyLedgerIcon}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.policyLedgerTitle}>Monthly Maintenance Ledger</Text>
                <Text style={styles.policyLedgerText}>
                  No wallet balance or card payment needed. All charging energy consumed is consolidated into your flat's monthly maintenance statement.
                </Text>
              </View>
            </View>
          </View>

          {/* Hardware & Engineering Diagnostics (Technical 3-Phase Readings) */}
          <View style={styles.profileSectionCard}>
            <View style={styles.profileSectionHeader}>
              <Text style={styles.profileSectionTitle}>Hardware & Phase Diagnostics</Text>
              <View style={styles.citrineVerifiedBadge}>
                <Text style={styles.citrineVerifiedText}>Live Telemetry</Text>
              </View>
            </View>
            <Text style={styles.profileSectionSub}>
              View live 3-phase readings (L1, L2, L3), voltage, current & raw hardware telemetry
            </Text>
            <Pressable
              style={styles.diagnosticsActionBtn}
              onPress={() => setDiagnosticsModalVisible(true)}
            >
              <Text style={styles.diagnosticsActionBtnText}>⚡ Open 3-Phase Engineering Monitor</Text>
            </Pressable>
          </View>

          {/* Basement Parking & Security Helpdesk */}
          <View style={styles.profileSectionCard}>
            <Text style={styles.profileSectionTitle}>Basement Security & Helpdesk</Text>
            <View style={styles.helpdeskItem}>
              <Text style={styles.helpdeskIcon}>👮</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.helpdeskTitle}>Basement 2 Guard Station</Text>
                <Text style={styles.helpdeskSubtitle}>Intercom: Ext 104 • Bay blocking & physical assistance</Text>
              </View>
            </View>
            <View style={styles.helpdeskItem}>
              <Text style={styles.helpdeskIcon}>🏢</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.helpdeskTitle}>Society Facility Manager</Text>
                <Text style={styles.helpdeskSubtitle}>Intercom: Ext 101 • Charger maintenance & reset</Text>
              </View>
            </View>
          </View>

          {/* App Version & Logout */}
          <Text style={styles.appVersionText}>tBits Plug • Apartment Community v2.4</Text>
          <Pressable
            style={styles.signOutBtn}
            onPress={async () => {
              await logout();
              router.replace('/');
            }}
          >
            <Text style={styles.signOutBtnText}>Sign Out of Apartment Account</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* -------------------------------------------------------------
          BOTTOM NAVIGATION BAR
      -------------------------------------------------------------- */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          style={styles.tabBtn}
          onPress={() => setActiveTab('HOME')}
          accessibilityLabel="Home tab"
        >
          <View style={[styles.tabIconWrap, activeTab === 'HOME' && styles.tabIconWrapActive]}>
            <HomeIcon size={20} color={activeTab === 'HOME' ? '#2563EB' : '#64748B'} focused={activeTab === 'HOME'} />
          </View>
          <Text style={[styles.tabLabel, activeTab === 'HOME' && styles.tabActiveText]}>Home</Text>
        </Pressable>

        <Pressable
          style={styles.tabBtn}
          onPress={() => setActiveTab('RECORDS')}
          accessibilityLabel="Records tab"
        >
          <View style={[styles.tabIconWrap, activeTab === 'RECORDS' && styles.tabIconWrapActive]}>
            <RecordsIcon size={20} color={activeTab === 'RECORDS' ? '#2563EB' : '#64748B'} focused={activeTab === 'RECORDS'} />
          </View>
          <Text style={[styles.tabLabel, activeTab === 'RECORDS' && styles.tabActiveText]}>Records</Text>
        </Pressable>

        <Pressable
          style={styles.tabBtn}
          onPress={() => setActiveTab('PROFILE')}
          accessibilityLabel="Profile tab"
        >
          <View style={[styles.tabIconWrap, activeTab === 'PROFILE' && styles.tabIconWrapActive]}>
            <ProfileIcon size={20} color={activeTab === 'PROFILE' ? '#2563EB' : '#64748B'} focused={activeTab === 'PROFILE'} />
          </View>
          <Text style={[styles.tabLabel, activeTab === 'PROFILE' && styles.tabActiveText]}>Profile</Text>
        </Pressable>
      </View>

      {/* -------------------------------------------------------------
          START CHARGING MODAL (WALK-IN VS RESERVATION)
      -------------------------------------------------------------- */}
      <Modal
        visible={startChargeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStartChargeModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Configure Charging Session</Text>
              <Text style={styles.modalSub}>
                {selectedChargerForBooking?.name} · {selectedChargerForBooking?.bayNumber}
              </Text>
            </View>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setStartChargeModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mode Selector Tabs (Immediate vs Reservation) */}
            <View style={styles.modeTabs}>
              <Pressable
                style={[
                  styles.modeTab,
                  chargingMode === 'WALK_IN' && styles.modeTabActive,
                ]}
                onPress={() => setChargingMode('WALK_IN')}
              >
                <Text style={styles.modeTabEmoji}>⚡</Text>
                <Text
                  style={[
                    styles.modeTabText,
                    chargingMode === 'WALK_IN' && styles.modeTabTextActive,
                  ]}
                >
                  Immediate Walk-in
                </Text>
                <Text
                  style={[
                    styles.modeTabRate,
                    chargingMode === 'WALK_IN' && styles.modeTabRateActive,
                  ]}
                >
                  ₹{selectedChargerForBooking?.walkInRatePerKwh || 15}/kWh
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modeTab,
                  chargingMode === 'RESERVE' && styles.modeTabActive,
                ]}
                onPress={() => setChargingMode('RESERVE')}
              >
                <Text style={styles.modeTabEmoji}>📅</Text>
                <Text
                  style={[
                    styles.modeTabText,
                    chargingMode === 'RESERVE' && styles.modeTabTextActive,
                  ]}
                >
                  Reserve Ahead
                </Text>
                <Text
                  style={[
                    styles.modeTabRateDiscount,
                    chargingMode === 'RESERVE' && styles.modeTabRateDiscountActive,
                  ]}
                >
                  ₹{selectedChargerForBooking?.reservationRatePerKwh || 11}/kWh (Save)
                </Text>
              </Pressable>
            </View>

            {/* Savings Callout Banner if Reserved */}
            {chargingMode === 'RESERVE' ? (
              <View style={styles.discountCallout}>
                <Text style={styles.discountCalloutIcon}>🎉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.discountCalloutTitle}>
                    Save ₹{selectedChargerForBooking ? selectedChargerForBooking.walkInRatePerKwh - selectedChargerForBooking.reservationRatePerKwh : 4} per kWh!
                  </Text>
                  <Text style={styles.discountCalloutSub}>
                    Advance planning reduces building transformer peaks. You pay the lower rate!
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.walkInCallout}>
                <Text style={styles.walkInCalloutIcon}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walkInCalloutTitle}>Instant Priority Charging</Text>
                  <Text style={styles.walkInCalloutSub}>
                    Charger will activate immediately upon scanning the QR code at the bay.
                  </Text>
                </View>
              </View>
            )}

            {/* Time Slot Picker for Reservation */}
            {chargingMode === 'RESERVE' && (
              <View style={styles.slotPickerSection}>
                <Text style={styles.fieldLabel}>Select Reservation Time Slot</Text>
                <View style={styles.slotOptions}>
                  {[
                    'Today, 04:00 PM - 05:30 PM',
                    'Today, 06:00 PM - 07:30 PM',
                    'Tomorrow, 08:00 AM - 09:30 AM',
                    'Tomorrow, 10:00 AM - 11:30 AM',
                  ].map((slot) => (
                    <Pressable
                      key={slot}
                      style={[
                        styles.slotChip,
                        selectedSlotTime === slot && styles.slotChipActive,
                      ]}
                      onPress={() => setSelectedSlotTime(slot)}
                    >
                      <Text
                        style={[
                          styles.slotChipText,
                          selectedSlotTime === slot && styles.slotChipTextActive,
                        ]}
                      >
                        {slot}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Energy Input */}
            <Text style={styles.fieldLabel}>How much energy do you need?</Text>
            <View style={styles.energyInputRow}>
              <TextInput
                style={styles.energyInput}
                value={requestedKwh.toString()}
                onChangeText={(text) => {
                  const val = Number(text.replace(/[^0-9.]/g, ''));
                  setRequestedKwh(isNaN(val) ? 0 : val);
                }}
                keyboardType="decimal-pad"
              />
              <Text style={styles.energyUnitSuffix}>kWh</Text>
            </View>

            {/* Quick Energy Chips */}
            <View style={styles.presetChipsRow}>
              {[5, 10, 15, 25, 35].map((amt) => (
                <Pressable
                  key={amt}
                  style={[
                    styles.presetChip,
                    requestedKwh === amt && styles.presetChipActive,
                  ]}
                  onPress={() => setRequestedKwh(amt)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      requestedKwh === amt && styles.presetChipTextActive,
                    ]}
                  >
                    {amt} kWh
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Estimate Summary Box */}
            <View style={styles.estimateBox}>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Selected Rate</Text>
                <Text style={styles.estimateValue}>₹{activeRate} / kWh</Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Requested Energy</Text>
                <Text style={styles.estimateValue}>{requestedKwh} kWh</Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Estimated Time</Text>
                <Text style={styles.estimateValue}>
                  ~{Math.round((requestedKwh / (selectedChargerForBooking?.powerKw || 7.4)) * 60)} mins
                </Text>
              </View>
              <View style={styles.estimateDivider} />
              <View style={styles.estimateRow}>
                <Text style={styles.estimateTotalLabel}>Estimated Total Bill</Text>
                <Text style={styles.estimateTotalValue}>₹{estimatedCost}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Fixed Sticky Footer for immediate visibility without scroll barrier */}
          <View style={styles.modalFooterPinned}>
            <Pressable
              style={styles.confirmCtaBtn}
              onPress={
                chargingMode === 'WALK_IN'
                  ? handleConfirmImmediateCharging
                  : handleConfirmReservation
              }
            >
              <Text style={styles.confirmCtaText}>
                {chargingMode === 'WALK_IN'
                  ? 'Proceed to Scan QR Code 📷'
                  : `Confirm Reservation (Save ₹${potentialSavings})`}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* -------------------------------------------------------------
          SCAN TO CHARGE CAMERA SHEET
      -------------------------------------------------------------- */}
      <ScanToChargeSheet
        visible={qrScannerVisible}
        vehicle={selectedVehicle}
        onClose={() => setQrScannerVisible(false)}
        onViewSlots={() => {
          setQrScannerVisible(false);
          setActiveTab('HOME');
        }}
      />

      {/* -------------------------------------------------------------
          NOTIFICATION CENTER MODAL
      -------------------------------------------------------------- */}
      <NotificationCenter
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
        onSelect={(dest) => {
          setNotificationModalVisible(false);
          if (dest === 'RECORDS') setActiveTab('RECORDS');
          else setActiveTab('HOME');
        }}
      />

      {/* -------------------------------------------------------------
          ENGINEERING 3-PHASE DIAGNOSTICS MODAL
      -------------------------------------------------------------- */}
      <EngineeringDiagnosticsModal
        visible={diagnosticsModalVisible}
        telemetry={liveTelemetry}
        onClose={() => setDiagnosticsModalVisible(false)}
      />

      {/* -------------------------------------------------------------
          VEHICLE SWITCHER MODAL
      -------------------------------------------------------------- */}
      <Modal
        visible={vehiclePickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setVehiclePickerVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setVehiclePickerVisible(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select Active Vehicle</Text>
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                style={[
                  styles.pickerItem,
                  selectedVehicle?.id === v.id && styles.pickerItemActive,
                ]}
                onPress={() => {
                  selectVehicle(v.id);
                  setVehiclePickerVisible(false);
                }}
              >
                <Text style={styles.pickerEmoji}>{v.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerName}>{v.name}</Text>
                  <Text style={styles.pickerSub}>
                    {v.plateNumber} • {v.connectorType}
                  </Text>
                </View>
                {selectedVehicle?.id === v.id && (
                  <Text style={styles.pickerCheck}>✓</Text>
                )}
              </Pressable>
            ))}

            <Pressable
              style={styles.addVehBtn}
              onPress={() => {
                setVehiclePickerVisible(false);
                router.push('/add-vehicle');
              }}
            >
              <Text style={styles.addVehBtnText}>+ Add New Vehicle</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* -------------------------------------------------------------
          CUSTOM DIALOG 1: SESSION STARTED POPUP
      -------------------------------------------------------------- */}
      <Modal
        visible={sessionStartedModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSessionStartedModalVisible(false)}
      >
        <View style={styles.customDialogOverlay}>
          <View style={styles.customDialogCard}>
            <View style={styles.dialogIconRingGreen}>
              <BoltIcon size={26} color="#16A34A" />
            </View>
            <Text style={styles.dialogTitle}>Charging Session Started!</Text>
            <Text style={styles.dialogSubtitle}>
              Electricity is now actively flowing into your EV.
            </Text>

            <View style={styles.dialogDetailsBox}>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Charger & Bay</Text>
                <Text style={styles.dialogDetailValue}>
                  {activeSessionCharger?.bayNumber || 'Bay 01'} · {activeSessionCharger?.name || 'Charger C1'}
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Tariff Applied</Text>
                <Text style={styles.dialogDetailValueGreen}>
                  ₹{liveTariff.pricePerKwh.toFixed(2)}/kWh (Society Tariff)
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Target Vehicle</Text>
                <Text style={styles.dialogDetailValue}>
                  {selectedVehicle?.name || 'Tata Nexon EV'} ({selectedVehicle?.plateNumber || 'MP 04 AB 1234'})
                </Text>
              </View>
              <View style={styles.dialogLedgerNotice}>
                <InfoIcon size={14} color="#15803D" />
                <Text style={styles.dialogLedgerText}>
                  Billed to your flat maintenance account. No immediate card or UPI payment required.
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.dialogPrimaryBtn}
              onPress={() => setSessionStartedModalVisible(false)}
            >
              <Text style={styles.dialogPrimaryBtnText}>View Live Session</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* -------------------------------------------------------------
          CUSTOM DIALOG 2: STOP CHARGING CONFIRMATION POPUP
      -------------------------------------------------------------- */}
      <Modal
        visible={stopConfirmModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setStopConfirmModalVisible(false)}
      >
        <View style={styles.customDialogOverlay}>
          <View style={styles.customDialogCard}>
            <View style={styles.dialogIconRingAmber}>
              <AlertTriangleIcon size={26} color="#D97706" />
            </View>
            <Text style={styles.dialogTitle}>Stop Charging Session?</Text>
            <Text style={styles.dialogSubtitle}>
              Power delivery will cease immediately. The delivered energy will be logged to your flat maintenance ledger.
            </Text>

            <View style={styles.dialogDetailsBox}>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Energy Delivered</Text>
                <Text style={styles.dialogDetailValueTabular}>
                  {deliveredKwh.toFixed(2)} kWh
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Elapsed Time</Text>
                <Text style={styles.dialogDetailValueTabular}>
                  {formattedElapsedTime}
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Current Amount</Text>
                <Text style={styles.dialogDetailValueGreenTabular}>
                  ₹{(deliveredKwh * liveTariff.pricePerKwh).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.dialogBtnRow}>
              <Pressable
                style={styles.dialogGhostBtn}
                onPress={() => setStopConfirmModalVisible(false)}
              >
                <Text style={styles.dialogGhostBtnText}>Keep Charging</Text>
              </Pressable>
              <Pressable
                style={styles.dialogDestructiveBtn}
                onPress={handleExecuteStopSession}
              >
                <Text style={styles.dialogDestructiveBtnText}>Yes, Stop</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* -------------------------------------------------------------
          CUSTOM DIALOG 3: SESSION COMPLETED RECEIPT POPUP
      -------------------------------------------------------------- */}
      <Modal
        visible={sessionSummaryModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSessionSummaryModalVisible(false)}
      >
        <View style={styles.customDialogOverlay}>
          <View style={styles.customDialogCard}>
            <View style={styles.dialogIconRingGreen}>
              <CheckCircleIcon size={28} color="#16A34A" />
            </View>
            <Text style={styles.dialogTitle}>Session Completed!</Text>
            <Text style={styles.dialogSubtitle}>
              Please unplug the connector and free the parking bay for your neighbors.
            </Text>

            <View style={styles.dialogDetailsBox}>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Charger Bay</Text>
                <Text style={styles.dialogDetailValue}>
                  {completedSessionData?.bayNumber || 'Bay 01'} · {completedSessionData?.chargerName || 'Charger C1'}
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Units Delivered</Text>
                <Text style={styles.dialogDetailValueTabular}>
                  {completedSessionData?.deliveredKwh.toFixed(2)} kWh
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Duration</Text>
                <Text style={styles.dialogDetailValueTabular}>
                  {completedSessionData?.durationMins} mins
                </Text>
              </View>
              <View style={styles.dialogDetailDivider} />
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailTotalLabel}>Total Session Bill</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.dialogDetailTotalValue}>
                    ₹{completedSessionData?.totalBill}
                  </Text>
                  <Text style={styles.dialogFormula}>
                    ({completedSessionData?.deliveredKwh.toFixed(2)} kWh × ₹{liveTariff.pricePerKwh.toFixed(2)})
                  </Text>
                </View>
              </View>

              <View style={styles.dialogLedgerSuccessBox}>
                <CheckCircleIcon size={14} color="#16A34A" />
                <Text style={styles.dialogLedgerSuccessText}>
                  Logged to Flat {user?.flatNumber || (user?.block ? `${user.block} - ${user.apartmentNumber}` : 'Tower A - 402')} Society Maintenance Ledger.
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.dialogPrimaryBtn}
              onPress={() => setSessionSummaryModalVisible(false)}
            >
              <Text style={styles.dialogPrimaryBtnText}>Done & Free Bay</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* -------------------------------------------------------------
          CUSTOM DIALOG 4: RESERVATION SUCCESS POPUP
      -------------------------------------------------------------- */}
      <Modal
        visible={reservationConfirmedModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setReservationConfirmedModalVisible(false)}
      >
        <View style={styles.customDialogOverlay}>
          <View style={styles.customDialogCard}>
            <View style={styles.dialogIconRingBlue}>
              <CalendarIcon size={26} color="#2563EB" />
            </View>
            <Text style={styles.dialogTitle}>Slot Reserved Successfully!</Text>
            <Text style={styles.dialogSubtitle}>
              Your advance charging slot is confirmed.
            </Text>

            <View style={styles.dialogDetailsBox}>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Charger</Text>
                <Text style={styles.dialogDetailValue}>
                  {confirmedReservationData?.chargerName}
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Scheduled Time</Text>
                <Text style={styles.dialogDetailValueBlue}>
                  {confirmedReservationData?.slotTime}
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Discounted Tariff</Text>
                <Text style={styles.dialogDetailValueGreen}>
                  ₹{confirmedReservationData?.rate}/kWh (Save ₹{confirmedReservationData?.savings}/kWh)
                </Text>
              </View>

              <View style={styles.dialogLedgerNotice}>
                <InfoIcon size={14} color="#15803D" />
                <Text style={styles.dialogLedgerText}>
                  Please arrive on time. Power used will be charged to your society maintenance bill.
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.dialogPrimaryBtn}
              onPress={() => setReservationConfirmedModalVisible(false)}
            >
              <Text style={styles.dialogPrimaryBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* -------------------------------------------------------------
          CUSTOM DIALOG 5: ACTIVE SESSION LIMIT WARNING (FAIR USE)
      -------------------------------------------------------------- */}
      <Modal
        visible={limitWarningModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setLimitWarningModalVisible(false)}
      >
        <View style={styles.customDialogOverlay}>
          <View style={styles.customDialogCard}>
            <View style={styles.dialogIconRingAmber}>
              <AlertTriangleIcon size={26} color="#D97706" />
            </View>
            <Text style={styles.dialogTitle}>Active Session in Progress</Text>
            <Text style={styles.dialogSubtitle}>
              Society fair-use policy permits 1 active charging session per flat.
            </Text>

            <View style={styles.dialogDetailsBox}>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Registered Flat</Text>
                <Text style={styles.dialogDetailValue}>
                  {user?.flatNumber || (user?.block ? `${user.block} - ${user.apartmentNumber}` : 'Tower A - 402')}
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Active Bay</Text>
                <Text style={styles.dialogDetailValue}>
                  {activeSessionCharger?.bayNumber || 'Bay 01'} ({activeSessionCharger?.name || 'Live Session'})
                </Text>
              </View>
              <View style={styles.dialogDetailRow}>
                <Text style={styles.dialogDetailLabel}>Energy So Far</Text>
                <Text style={styles.dialogDetailValueGreenTabular}>
                  {deliveredKwh.toFixed(2)} kWh delivered
                </Text>
              </View>

              <View style={styles.dialogLedgerNotice}>
                <InfoIcon size={14} color="#15803D" />
                <Text style={styles.dialogLedgerText}>
                  Please stop your current charging session on {activeSessionCharger?.bayNumber || 'Bay 01'} before plugging in or starting a session for another vehicle.
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.dialogPrimaryBtn}
              onPress={() => setLimitWarningModalVisible(false)}
            >
              <Text style={styles.dialogPrimaryBtnText}>Understood</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  // Top Header
  topHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandLogo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellIcon: { fontSize: 16 },
  unreadBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 4,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: { color: '#1D4ED8', fontWeight: '600', fontSize: 15 },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },

  // Vehicle Pill
  vehicleHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    maxWidth: 160,
  },
  vehiclePillEmoji: { fontSize: 18 },
  vehiclePillTextCol: { flexShrink: 1 },
  vehiclePillName: { fontSize: 12, fontWeight: '600', color: '#1E3A8A' },
  vehiclePillPlate: { fontSize: 10, color: '#3B82F6', fontWeight: '500' },
  vehiclePillArrow: { fontSize: 12, color: '#2563EB', fontWeight: '600' },

  mainScroll: { paddingHorizontal: 20, paddingTop: 16 },

  // 3-Step Guide Card
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  guideHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepNumber: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  stepTitle: { fontSize: 12, fontWeight: '600', color: '#0F172A', textAlign: 'center' },
  stepSub: { fontSize: 10, color: '#64748B', textAlign: 'center', marginTop: 1 },
  stepArrow: { paddingBottom: 14 },
  arrowText: { fontSize: 14, color: '#CBD5E1', fontWeight: '600' },

  // Dynamic Live Hero Card (Crisp White + Emerald Theme)
  liveHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    shadowColor: '#10B981',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  liveHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveHeroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  liveGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveHeroTagText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  liveHeroBay: { color: '#64748B', fontSize: 13, fontWeight: '500' },

  // Gauge (Light Theme with Emerald Dial)
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    height: 180,
  },
  gaugePulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: '#34D399',
    opacity: 0.35,
  },
  gaugeCenterDisc: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: '#F0FDF4',
    borderWidth: 3,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  gaugeBigEnergy: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  gaugeUnit: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: -2 },
  gaugePowerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  gaugePowerText: { fontSize: 11, fontWeight: '600', color: '#0284C7' },

  // Progress Bar
  progressBarWrapper: { marginTop: 10, marginBottom: 16 },
  progressBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  progressPercent: { fontSize: 12, color: '#059669', fontWeight: '600', fontVariant: ['tabular-nums'] },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#10B981',
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  metricBox: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  metricVal: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginTop: 3, fontVariant: ['tabular-nums'] },
  metricValCost: { fontSize: 15, fontWeight: '700', color: '#059669', marginTop: 3, fontVariant: ['tabular-nums'] },
  metricDivider: { width: 1, height: 26, backgroundColor: '#E2E8F0' },

  stopChargingBtn: {
    height: 44,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  stopChargingBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },

  // Section Header & Filters
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#0F172A' },
  sectionSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  simulatePill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  simulatePillText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipText: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Charger Cards
  chargerList: { gap: 14 },
  chargerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chargerMetaCol: { flex: 1, marginRight: 8 },
  chargerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chargerName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  bayBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bayBadgeText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  chargerSubDetail: { fontSize: 12, color: '#64748B', marginTop: 3, fontWeight: '500' },

  // Status Pills
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  statusAvailable: { backgroundColor: '#DCFCE7' },
  statusOccupied: { backgroundColor: '#FEF3C7' },
  statusReserved: { backgroundColor: '#F1F5F9' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotAvailable: { backgroundColor: '#16A34A' },
  statusDotOccupied: { backgroundColor: '#D97706' },
  statusDotReserved: { backgroundColor: '#64748B' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextAvailable: { color: '#15803D' },
  statusTextOccupied: { color: '#B45309' },
  statusTextReserved: { color: '#475569' },

  compatibleBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 10,
  },
  compatibleText: { fontSize: 11, color: '#15803D', fontWeight: '600' },

  // Minimal Dual-Pricing Row (Change #6)
  minimalPricingBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    alignItems: 'center',
  },
  minimalPriceCol: { flex: 1 },
  minimalPriceLabel: { fontSize: 11, fontWeight: '500', color: '#64748B' },
  minimalPriceVal: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  minimalPriceValGreen: { fontSize: 15, fontWeight: '600', color: '#16A34A', marginTop: 2 },
  minimalPriceUnit: { fontSize: 11, color: '#64748B', fontWeight: '400' },
  minimalPriceDivider: { width: 1, height: 26, backgroundColor: '#E2E8F0', marginHorizontal: 12 },
  minimalSaveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  minimalSaveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  minimalSaveBadgeText: { fontSize: 9, fontWeight: '600', color: '#15803D' },

  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  occupiedEstimate: { fontSize: 12, color: '#D97706', fontWeight: '600' },
  actionBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  actionBtnStart: { backgroundColor: '#16A34A' },
  actionBtnReserve: { backgroundColor: '#2563EB' },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  actionBtnTextStart: { color: '#FFFFFF' },
  actionBtnTextReserve: { color: '#FFFFFF' },

  // Bottom Tab Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabIconWrap: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 2,
  },
  tabIconWrapActive: {
    backgroundColor: '#EFF6FF',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  tabActiveText: {
    color: '#2563EB',
    fontWeight: '600',
  },

  // Start Charging Modal
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  modalSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  modalScrollView: { flex: 1 },
  modalScrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60, flexGrow: 1 },

  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    gap: 6,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabEmoji: { fontSize: 18, marginBottom: 2 },
  modeTabText: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  modeTabTextActive: { color: '#0F172A', fontWeight: '600' },
  modeTabRate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  modeTabRateActive: { color: '#2563EB', fontWeight: '600' },
  modeTabRateDiscount: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  modeTabRateDiscountActive: { color: '#16A34A', fontWeight: '600' },

  discountCallout: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 18,
    alignItems: 'center',
  },
  discountCalloutIcon: { fontSize: 20 },
  discountCalloutTitle: { fontSize: 13, fontWeight: '600', color: '#15803D' },
  discountCalloutSub: { fontSize: 11, color: '#166534', marginTop: 2 },

  walkInCallout: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 18,
    alignItems: 'center',
  },
  walkInCalloutIcon: { fontSize: 20 },
  walkInCalloutTitle: { fontSize: 13, fontWeight: '600', color: '#1E40AF' },
  walkInCalloutSub: { fontSize: 11, color: '#1E3A8A', marginTop: 2 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginTop: 6,
  },
  slotPickerSection: { marginBottom: 16 },
  slotOptions: { gap: 8 },
  slotChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  slotChipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  slotChipTextActive: { color: '#2563EB', fontWeight: '600' },

  energyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  energyInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  energyUnitSuffix: { fontSize: 14, fontWeight: '600', color: '#64748B' },

  presetChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  presetChipActive: { backgroundColor: '#2563EB' },
  presetChipText: { fontSize: 12, fontWeight: '500', color: '#475569' },
  presetChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  estimateBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    gap: 8,
  },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between' },
  estimateLabel: { fontSize: 13, color: '#64748B', fontWeight: '400' },
  estimateValue: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  estimateDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  estimateTotalLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  estimateTotalValue: { fontSize: 18, fontWeight: '700', color: '#16A34A' },

  modalFooterPinned: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  confirmCtaBtn: {
    height: 50,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmCtaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // Profile Hub Styles (Change #5)
  profileHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  profileHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileAvatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarLargeText: {
    color: '#1D4ED8',
    fontSize: 22,
    fontWeight: '700',
  },
  profileNameCol: { flex: 1 },
  profileFullName: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  profileSubInfo: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '500' },
  residentBadge: {
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  residentBadgeText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },
  profileContactDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  profileContactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileContactLabel: { fontSize: 12, color: '#64748B' },
  profileContactValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },

  profileSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  profileSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileSectionTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  profileSectionSub: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 12 },
  switchVehInlineBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  switchVehInlineText: { fontSize: 11, color: '#2563EB', fontWeight: '600' },
  garageVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    gap: 12,
  },
  garageVehicleEmoji: { fontSize: 26 },
  garageVehicleName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  garageVehiclePlate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  garageBatteryPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  garageBatteryText: { fontSize: 11, fontWeight: '600', color: '#059669' },

  tariffPolicyGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    alignItems: 'center',
    marginBottom: 12,
  },
  tariffPolicyCol: { flex: 1, alignItems: 'center' },
  tariffPolicyLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  tariffPolicyVal: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 3 },
  tariffPolicyValGreen: { fontSize: 16, fontWeight: '700', color: '#16A34A', marginTop: 3 },
  tariffUnit: { fontSize: 11, fontWeight: '400', color: '#64748B' },
  tariffPolicyDesc: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  tariffPolicyDescDiscount: { fontSize: 10, color: '#16A34A', fontWeight: '600', marginTop: 2 },
  tariffPolicyDivider: { width: 1, height: 36, backgroundColor: '#E2E8F0' },

  policyLedgerNotice: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    alignItems: 'flex-start',
  },
  policyLedgerIcon: { fontSize: 14, marginTop: 1 },
  policyLedgerTitle: { fontSize: 12, fontWeight: '600', color: '#15803D' },
  policyLedgerText: { fontSize: 11, color: '#166534', marginTop: 2, lineHeight: 16 },

  helpdeskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  helpdeskIcon: { fontSize: 20 },
  helpdeskTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  helpdeskSubtitle: { fontSize: 11, color: '#64748B', marginTop: 1 },

  appVersionText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 10,
    marginBottom: 12,
  },
  signOutBtn: {
    height: 46,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signOutBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },

  // Custom Branded Popups (Change #3)
  customDialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  customDialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  dialogIconRingGreen: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dialogIconRingAmber: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dialogIconRingBlue: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dialogIconEmoji: { fontSize: 24 },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  dialogSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 17,
  },
  dialogDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 18,
    gap: 8,
  },
  dialogDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogDetailLabel: { fontSize: 13, color: '#475569' },
  dialogDetailValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  dialogDetailValueTabular: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  dialogDetailValueGreen: { fontSize: 13, fontWeight: '600', color: '#16A34A' },
  dialogDetailValueGreenTabular: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
    fontVariant: ['tabular-nums'],
  },
  dialogDetailValueBlue: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  dialogDetailDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 6 },
  dialogDetailTotalLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  dialogDetailTotalValue: { fontSize: 17, fontWeight: '700', color: '#16A34A', fontVariant: ['tabular-nums'] },
  dialogFormula: { fontSize: 11, color: '#64748B', marginTop: 2, fontVariant: ['tabular-nums'] },
  dialogLedgerNotice: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    gap: 8,
    alignItems: 'center',
  },
  dialogLedgerIcon: { fontSize: 12 },
  dialogLedgerText: { fontSize: 11, color: '#166534', flex: 1, lineHeight: 16 },
  dialogLedgerSuccessBox: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    gap: 8,
    alignItems: 'center',
  },
  dialogLedgerSuccessIcon: { fontSize: 12, color: '#16A34A', fontWeight: '700' },
  dialogLedgerSuccessText: { fontSize: 11, color: '#166534', flex: 1, fontWeight: '500' },
  dialogPrimaryBtn: {
    width: '100%',
    height: 46,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogPrimaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  dialogBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogGhostBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogGhostBtnText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  dialogDestructiveBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogDestructiveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Vehicle Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  pickerTitle: { fontSize: 17, fontWeight: '600', color: '#0F172A', marginBottom: 14 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 10,
  },
  pickerItemActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  pickerEmoji: { fontSize: 24 },
  pickerName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  pickerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  pickerCheck: { fontSize: 16, color: '#2563EB', fontWeight: '600' },
  addVehBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginTop: 6,
  },
  addVehBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  hasuraSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pulseDotGreen: {
    backgroundColor: '#10B981',
  },
  pulseDotMuted: {
    backgroundColor: '#94A3B8',
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeMuted: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  hasuraSyncText: {
    fontSize: 10,
    fontWeight: '600',
  },
  textGreen: {
    color: '#059669',
  },
  textMuted: {
    color: '#64748B',
  },
  citrineVerifiedBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  citrineVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  diagnosticsActionBtn: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 10,
  },
  diagnosticsActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});
