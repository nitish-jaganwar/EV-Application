import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useVehicle } from '@/context/VehicleContext';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import ChargingRecords from '@/components/ChargingRecords';
import ScanToChargeSheet from '@/features/booking/ScanToChargeSheet';
import { useChargerTelemetry } from '@/hooks/use-charger-telemetry';
import { useChargerHistory } from '@/hooks/use-charger-history';
import {
  APARTMENT_CHARGERS,
  ChargerItem,
} from '@/services/chargerInventory';
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
  const { unreadCount } = useNotifications();

  // Navigation tab: 'HOME' | 'RECORDS' | 'SETTINGS'
  const [activeTab, setActiveTab] = useState<'HOME' | 'RECORDS' | 'SETTINGS'>('HOME');

  // Filter for chargers
  const [filterType, setFilterType] = useState<'ALL' | 'AVAILABLE' | 'COMPATIBLE'>('ALL');

  // Modals & Sheets
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [vehiclePickerVisible, setVehiclePickerVisible] = useState(false);
  const [startChargeModalVisible, setStartChargeModalVisible] = useState(false);
  const [selectedChargerForBooking, setSelectedChargerForBooking] = useState<ChargerItem | null>(null);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);

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
  const { telemetry: liveTelemetry } = useChargerTelemetry();
  const { points: meterHistory, isLoading: isHistoryLoading, error: historyError } = useChargerHistory(liveTelemetry);

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

      // Timer to increment elapsed time & energy
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        setDeliveredKwh((prev) => {
          if (prev >= targetKwh) return prev;
          return Number((prev + 0.003).toFixed(3));
        });
      }, 1000);

      return () => {
        pulse.stop();
        rotate.stop();
        clearInterval(timer);
      };
    }
  }, [isChargingActive, pulseAnim, rotateAnim, targetKwh]);

  // Format Elapsed Time
  const formattedElapsedTime = useMemo(() => {
    const hrs = Math.floor(elapsedSeconds / 3600);
    const mins = Math.floor((elapsedSeconds % 3600) / 60);
    const secs = elapsedSeconds % 60;
    return `${hrs > 0 ? `${hrs}h ` : ''}${mins < 10 ? `0${mins}` : mins}m ${secs < 10 ? `0${secs}` : secs}s`;
  }, [elapsedSeconds]);

  // Filtered Chargers
  const filteredChargers = useMemo(() => {
    return APARTMENT_CHARGERS.filter((charger) => {
      if (filterType === 'AVAILABLE') return charger.status === 'AVAILABLE';
      if (filterType === 'COMPATIBLE') {
        if (!selectedVehicle) return true;
        return charger.connectorType === selectedVehicle.connectorType;
      }
      return true;
    });
  }, [filterType, selectedVehicle]);

  // Handle open Start Charging Modal
  const handleOpenStartCharging = (charger: ChargerItem) => {
    setSelectedChargerForBooking(charger);
    setChargingMode(charger.status === 'AVAILABLE' ? 'WALK_IN' : 'RESERVE');
    setStartChargeModalVisible(true);
  };

  // Confirm Immediate Walk-in Charging
  const handleConfirmImmediateCharging = () => {
    if (!selectedChargerForBooking) return;
    setStartChargeModalVisible(false);
    const charger = selectedChargerForBooking;
    setActiveSessionCharger(charger);
    setTargetKwh(requestedKwh);
    setDeliveredKwh(0.1);
    setElapsedSeconds(10);
    setIsChargingActive(true);
    Alert.alert(
      '⚡ Walk-in Charging Started!',
      `Connected to ${charger.name} at ${charger.bayNumber}.\nRate: ₹${charger.walkInRatePerKwh}/kWh.\nElectricity is flowing to your ${selectedVehicle?.name || 'EV'}.`
    );
  };

  // Confirm Reservation Booking
  const handleConfirmReservation = () => {
    if (!selectedChargerForBooking) return;
    setStartChargeModalVisible(false);
    Alert.alert(
      'Slot Reserved Successfully! 📅',
      `Your booking for ${selectedChargerForBooking.name} (${selectedSlotTime}) has been confirmed at the discounted rate of ₹${selectedChargerForBooking.reservationRatePerKwh}/kWh.`
    );
  };

  // Stop Charging Action
  const handleStopCharging = () => {
    Alert.alert(
      'Stop Charging?',
      'Are you sure you want to stop power delivery and end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop & Pay',
          style: 'destructive',
          onPress: () => {
            setIsChargingActive(false);
            const totalBill = (
              deliveredKwh * (activeSessionCharger?.walkInRatePerKwh || 15)
            ).toFixed(2);
            Alert.alert(
              'Session Completed 🏁',
              `Delivered: ${deliveredKwh.toFixed(2)} kWh\nTotal Bill: ₹${totalBill}\n\nPlease unplug and free the bay for fellow residents.`
            );
          },
        },
      ]
    );
  };

  // Calculate costs in sheet
  const activeRate = selectedChargerForBooking
    ? chargingMode === 'WALK_IN'
      ? selectedChargerForBooking.walkInRatePerKwh
      : selectedChargerForBooking.reservationRatePerKwh
    : 15;
  const estimatedCost = (requestedKwh * activeRate).toFixed(2);
  const walkInTotal = selectedChargerForBooking
    ? (requestedKwh * selectedChargerForBooking.walkInRatePerKwh).toFixed(2)
    : '0';
  const reservationTotal = selectedChargerForBooking
    ? (requestedKwh * selectedChargerForBooking.reservationRatePerKwh).toFixed(2)
    : '0';
  const potentialSavings = (Number(walkInTotal) - Number(reservationTotal)).toFixed(0);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* -------------------------------------------------------------
          TOP BAR (GREETING + VEHICLE PILL + BELL)
      -------------------------------------------------------------- */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <Text style={styles.brandLogo}>⚡ tBits Plug</Text>
          <View style={styles.headerRightActions}>
            <Pressable
              style={styles.bellButton}
              onPress={() => setNotificationModalVisible(true)}
              accessibilityLabel="Notifications"
            >
              <Text style={styles.bellIcon}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.profileAvatar}
              onPress={() => setActiveTab('SETTINGS')}
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
                <Text style={styles.liveHeroBay}>
                  {activeSessionCharger?.name || 'Charger C1'} · {activeSessionCharger?.bayNumber || 'Bay 01'}
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
                    <Text style={styles.gaugePowerText}>
                      ⚡ {activeSessionCharger?.powerKw || 7.2} kW Speed
                    </Text>
                  </View>
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
                    ~{Math.max(0, Math.round(((targetKwh - deliveredKwh) / (activeSessionCharger?.powerKw || 7.2)) * 60))} min
                  </Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Current Cost</Text>
                  <Text style={styles.metricValCost}>
                    ₹{(deliveredKwh * (activeSessionCharger?.walkInRatePerKwh || 15)).toFixed(1)}
                  </Text>
                </View>
              </View>

              {/* Stop Charging CTA */}
              <Pressable
                style={styles.stopChargingBtn}
                onPress={handleStopCharging}
              >
                <Text style={styles.stopChargingBtnText}>⏹ Stop Charging</Text>
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
            <View>
              <Text style={styles.sectionTitle}>Apartment Parking Chargers</Text>
              <Text style={styles.sectionSub}>
                Real-time bay availability & power capacity
              </Text>
            </View>
            {/* Quick Demo Simulate Button */}
            {!isChargingActive && (
              <Pressable
                style={styles.simulatePill}
                onPress={() => {
                  setActiveSessionCharger(APARTMENT_CHARGERS[0]);
                  setIsChargingActive(true);
                }}
              >
                <Text style={styles.simulatePillText}>⚡ Demo Session</Text>
              </Pressable>
            )}
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
                All Chargers ({APARTMENT_CHARGERS.length})
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
                🟢 Available Only
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
            {filteredChargers.map((charger) => {
              const isAvailable = charger.status === 'AVAILABLE';
              const isOccupied = charger.status === 'OCCUPIED';
              const isReserved = charger.status === 'RESERVED';
              const isCompatible =
                selectedVehicle?.connectorType === charger.connectorType;

              return (
                <View key={charger.id} style={styles.chargerCard}>
                  {/* Card Header */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.chargerMetaCol}>
                      <View style={styles.chargerTitleRow}>
                        <Text style={styles.chargerName}>{charger.name}</Text>
                        <View style={styles.bayBadge}>
                          <Text style={styles.bayBadgeText}>{charger.bayNumber}</Text>
                        </View>
                      </View>
                      <Text style={styles.chargerSubDetail}>
                        {charger.powerKw} kW {charger.powerType} • {charger.connectorType}
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
                        {isAvailable ? 'AVAILABLE' : isOccupied ? 'OCCUPIED' : 'RESERVED'}
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

                  {/* Dual Pricing Comparison Box */}
                  <View style={styles.pricingComparisonBox}>
                    <View style={styles.pricingCol}>
                      <Text style={styles.pricingHeader}>⚡ Immediate Walk-in</Text>
                      <Text style={styles.walkInPriceText}>
                        ₹{charger.walkInRatePerKwh}
                        <Text style={styles.perKwh}> / kWh</Text>
                      </Text>
                      <Text style={styles.pricingNote}>Instant start</Text>
                    </View>

                    <View style={styles.pricingDivider} />

                    <View style={styles.pricingCol}>
                      <View style={styles.discountRow}>
                        <Text style={styles.pricingHeader}>📅 Reserve Slot</Text>
                        <View style={styles.saveBadge}>
                          <Text style={styles.saveBadgeText}>
                            Save ₹{charger.walkInRatePerKwh - charger.reservationRatePerKwh}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.reservationPriceText}>
                        ₹{charger.reservationRatePerKwh}
                        <Text style={styles.perKwh}> / kWh</Text>
                      </Text>
                      <Text style={styles.pricingNoteDiscount}>Pre-booked slot</Text>
                    </View>
                  </View>

                  {/* Footer Action */}
                  <View style={styles.cardFooter}>
                    {isOccupied && charger.estimatedAvailableTime && (
                      <Text style={styles.occupiedEstimate}>
                        ⏳ Free in {charger.estimatedAvailableTime}
                      </Text>
                    )}

                    <Pressable
                      style={[
                        styles.actionBtn,
                        isAvailable ? styles.actionBtnStart : styles.actionBtnReserve,
                      ]}
                      onPress={() => handleOpenStartCharging(charger)}
                    >
                      <Text
                        style={[
                          styles.actionBtnText,
                          isAvailable ? styles.actionBtnTextStart : styles.actionBtnTextReserve,
                        ]}
                      >
                        {isAvailable ? '⚡ Start Charging' : '📅 Reserve Slot'}
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
            ownerId={user?.mobile ?? null}
          />
        </ScrollView>
      )}

      {/* -------------------------------------------------------------
          TAB 3: SETTINGS & PROFILE
      -------------------------------------------------------------- */}
      {activeTab === 'SETTINGS' && (
        <ScrollView contentContainerStyle={styles.mainScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Resident Profile</Text>
            <Text style={styles.profileRow}>Name: <Text style={styles.bold}>{user?.fullName || 'Resident'}</Text></Text>
            <Text style={styles.profileRow}>Mobile: <Text style={styles.bold}>{user?.mobile || '8305763637'}</Text></Text>
            <Text style={styles.profileRow}>Apartment: <Text style={styles.bold}>{user?.flatNumber || 'Tower A - 402'}</Text></Text>
            <Text style={styles.profileRow}>Resident Type: <Text style={styles.bold}>{user?.residentType || 'OWNER'}</Text></Text>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Active Vehicle</Text>
            <Text style={styles.profileRow}>Vehicle: <Text style={styles.bold}>{selectedVehicle?.name}</Text></Text>
            <Text style={styles.profileRow}>Plate: <Text style={styles.bold}>{selectedVehicle?.plateNumber}</Text></Text>
            <Text style={styles.profileRow}>Connector: <Text style={styles.bold}>{selectedVehicle?.connectorType}</Text></Text>
            <Text style={styles.profileRow}>Battery: <Text style={styles.bold}>{selectedVehicle?.batteryCapacityKwh} kWh</Text></Text>

            <Pressable
              style={styles.switchVehBtn}
              onPress={() => setVehiclePickerVisible(true)}
            >
              <Text style={styles.switchVehText}>Change or Add Vehicle</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.logoutBtn}
            onPress={async () => {
              await logout();
              router.replace('/');
            }}
          >
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* -------------------------------------------------------------
          BOTTOM NAVIGATION BAR
      -------------------------------------------------------------- */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={styles.tabBtn}
          onPress={() => setActiveTab('HOME')}
        >
          <Text style={[styles.tabIcon, activeTab === 'HOME' && styles.tabActiveText]}>⚡</Text>
          <Text style={[styles.tabLabel, activeTab === 'HOME' && styles.tabActiveText]}>Chargers</Text>
        </Pressable>

        <Pressable
          style={styles.tabBtn}
          onPress={() => setActiveTab('RECORDS')}
        >
          <Text style={[styles.tabIcon, activeTab === 'RECORDS' && styles.tabActiveText]}>📜</Text>
          <Text style={[styles.tabLabel, activeTab === 'RECORDS' && styles.tabActiveText]}>Records</Text>
        </Pressable>

        <Pressable
          style={styles.tabBtn}
          onPress={() => setActiveTab('SETTINGS')}
        >
          <Text style={[styles.tabIcon, activeTab === 'SETTINGS' && styles.tabActiveText]}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'SETTINGS' && styles.tabActiveText]}>Settings</Text>
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

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
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

            {/* Action CTA */}
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
          </ScrollView>
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
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: -0.5,
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
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: { color: '#1D4ED8', fontWeight: '700', fontSize: 15 },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
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
  vehiclePillName: { fontSize: 12, fontWeight: '700', color: '#1E3A8A' },
  vehiclePillPlate: { fontSize: 10, color: '#3B82F6', fontWeight: '600' },
  vehiclePillArrow: { fontSize: 12, color: '#2563EB', fontWeight: '800' },

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
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  stepNumber: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
  stepTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  stepSub: { fontSize: 10, color: '#64748B', textAlign: 'center', marginTop: 1 },
  stepArrow: { paddingBottom: 14 },
  arrowText: { fontSize: 14, color: '#CBD5E1', fontWeight: '700' },

  // Dynamic Live Hero Card
  liveHeroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 22,
    marginBottom: 24,
    shadowColor: '#0284C7',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  liveHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  liveHeroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveHeroBay: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  // Gauge
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    height: 180,
  },
  gaugePulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: '#38BDF8',
    opacity: 0.4,
  },
  gaugeCenterDisc: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: '#1E293B',
    borderWidth: 3,
    borderColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  gaugeBigEnergy: { fontSize: 32, fontWeight: '900', color: '#FFFFFF' },
  gaugeUnit: { fontSize: 12, color: '#94A3B8', fontWeight: '500', marginTop: -2 },
  gaugePowerTag: {
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  gaugePowerText: { fontSize: 11, fontWeight: '700', color: '#38BDF8' },

  // Progress Bar
  progressBarWrapper: { marginTop: 10, marginBottom: 18 },
  progressBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  progressPercent: { fontSize: 12, color: '#38BDF8', fontWeight: '800' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
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
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  metricBox: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  metricVal: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  metricValCost: { fontSize: 15, fontWeight: '900', color: '#34D399', marginTop: 3 },
  metricDivider: { width: 1, height: 28, backgroundColor: '#334155' },

  stopChargingBtn: {
    height: 48,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stopChargingBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  // Section Header & Filters
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  sectionSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  simulatePill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  simulatePillText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },

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
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

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
    alignItems: 'flex-start',
  },
  chargerMetaCol: { flex: 1, marginRight: 8 },
  chargerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chargerName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  bayBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bayBadgeText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  chargerSubDetail: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '500' },

  // Status Pills
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  statusAvailable: { backgroundColor: '#DCFCE7' },
  statusOccupied: { backgroundColor: '#FEF3C7' },
  statusReserved: { backgroundColor: '#F1F5F9' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotAvailable: { backgroundColor: '#16A34A' },
  statusDotOccupied: { backgroundColor: '#D97706' },
  statusDotReserved: { backgroundColor: '#64748B' },
  statusText: { fontSize: 11, fontWeight: '800' },
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
  compatibleText: { fontSize: 11, color: '#15803D', fontWeight: '700' },

  // Dual Pricing Comparison Box
  pricingComparisonBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  pricingCol: { flex: 1, paddingHorizontal: 4 },
  pricingHeader: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  walkInPriceText: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  reservationPriceText: { fontSize: 17, fontWeight: '900', color: '#16A34A', marginTop: 2 },
  perKwh: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  pricingNote: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  pricingNoteDiscount: { fontSize: 10, color: '#16A34A', fontWeight: '700', marginTop: 2 },
  pricingDivider: { width: 1, backgroundColor: '#E2E8F0', marginHorizontal: 8 },
  discountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  saveBadgeText: { fontSize: 9, fontWeight: '800', color: '#15803D' },

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
  occupiedEstimate: { fontSize: 12, color: '#D97706', fontWeight: '700' },
  actionBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  actionBtnStart: { backgroundColor: '#16A34A' },
  actionBtnReserve: { backgroundColor: '#2563EB' },
  actionBtnText: { fontSize: 13, fontWeight: '800' },
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
    paddingTop: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: 2 },
  tabActiveText: { color: '#2563EB', fontWeight: '800' },

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
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 14, color: '#64748B', fontWeight: '700' },
  modalBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

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
  modeTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  modeTabTextActive: { color: '#0F172A', fontWeight: '800' },
  modeTabRate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  modeTabRateActive: { color: '#2563EB', fontWeight: '700' },
  modeTabRateDiscount: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  modeTabRateDiscountActive: { color: '#16A34A', fontWeight: '800' },

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
  discountCalloutTitle: { fontSize: 13, fontWeight: '800', color: '#15803D' },
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
  walkInCalloutTitle: { fontSize: 13, fontWeight: '800', color: '#1E40AF' },
  walkInCalloutSub: { fontSize: 11, color: '#1E3A8A', marginTop: 2 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
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
  slotChipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  slotChipTextActive: { color: '#2563EB', fontWeight: '800' },

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
    fontWeight: '800',
    color: '#0F172A',
  },
  energyUnitSuffix: { fontSize: 14, fontWeight: '700', color: '#64748B' },

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
  presetChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  presetChipTextActive: { color: '#FFFFFF', fontWeight: '800' },

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
  estimateLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  estimateValue: { fontSize: 13, color: '#0F172A', fontWeight: '700' },
  estimateDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  estimateTotalLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  estimateTotalValue: { fontSize: 18, fontWeight: '900', color: '#16A34A' },

  confirmCtaBtn: {
    height: 52,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 30,
  },
  confirmCtaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  // Settings
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  settingsTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  profileRow: { fontSize: 14, color: '#475569', marginBottom: 8 },
  bold: { fontWeight: '700', color: '#0F172A' },
  switchVehBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  switchVehText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  logoutBtn: {
    height: 48,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  logoutBtnText: { color: '#DC2626', fontWeight: '800', fontSize: 14 },

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
  pickerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
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
  pickerName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  pickerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  pickerCheck: { fontSize: 16, color: '#2563EB', fontWeight: '800' },
  addVehBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginTop: 6,
  },
  addVehBtnText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
});
