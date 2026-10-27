import type { Vehicle } from '@/context/VehicleContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APARTMENT_CHARGERS, type ChargerItem } from '@/services/chargerInventory';
import {
  QrCodeIcon,
  FlashlightIcon,
  BoltIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from '@/components/ui/AppIcons';

interface ScanToChargeSheetProps {
  visible: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onViewSlots: () => void;
  onSelectCharger?: (charger: ChargerItem) => void;
}

export default function ScanToChargeSheet({
  visible,
  vehicle,
  onClose,
  onViewSlots,
  onSelectCharger,
}: ScanToChargeSheetProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState<boolean>(false);
  const [scannedCharger, setScannedCharger] = useState<ChargerItem | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Reset state whenever modal is opened
  useEffect(() => {
    if (visible) {
      setScannedCharger(null);
      setScanError(null);
      setTorch(false);
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedCharger) return; // Prevent duplicate reads
    const raw = data.trim();
    // Normalize string: strip scheme prefixes like tbits://charger/ or url
    const normalized = raw
      .replace(/^tbits:\/\/charger\//i, '')
      .replace(/^https?:\/\/.*\/charger\//i, '')
      .toUpperCase();

    // Match by charger id, bay number, or short code
    const matched = APARTMENT_CHARGERS.find((c) => {
      const cId = c.id.toUpperCase();
      const bNum = c.bayNumber.toUpperCase().replace(/\s+/g, '');
      const numOnly = c.bayNumber.replace(/[^0-9]/g, '');
      const searchKey = normalized.replace(/\s+/g, '');
      return (
        cId === searchKey ||
        cId.includes(searchKey) ||
        bNum === searchKey ||
        `BAY${numOnly}` === searchKey ||
        `P${numOnly.padStart(2, '0')}` === searchKey ||
        `C${numOnly}` === searchKey ||
        c.name.toUpperCase().includes(searchKey)
      );
    });

    if (matched) {
      setScannedCharger(matched);
      setScanError(null);
    } else {
      setScanError(`QR "${raw.slice(0, 24)}" is not a recognized tBits parking charger.`);
    }
  };

  const handleSelectPreconfiguredBay = (bayNumber: string) => {
    const found = APARTMENT_CHARGERS.find((c) => c.bayNumber.includes(bayNumber));
    if (found) {
      setScannedCharger(found);
      setScanError(null);
    }
  };

  const isCompatible = (charger: ChargerItem) => {
    if (!vehicle) return true;
    if (vehicle.type === '2W') {
      return charger.connectorType === '15A Socket';
    }
    return charger.connectorType === 'Type 2' || charger.connectorType === 'CCS2';
  };

  const handleConfirmStart = () => {
    if (!scannedCharger) return;
    if (onSelectCharger) {
      onSelectCharger(scannedCharger);
    } else {
      onClose();
      onViewSlots();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <Text style={styles.closeIconText}>✕</Text>
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Scan to Charge</Text>
            <Text style={styles.headerSubtitle}>
              {vehicle?.name ? `Active EV: ${vehicle.name}` : 'Apartment EV Network'}
            </Text>
          </View>

          <Pressable
            style={[styles.headerBtn, torch && styles.headerBtnActive]}
            onPress={() => setTorch((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Toggle flashlight"
          >
            <FlashlightIcon size={19} color={torch ? '#2563EB' : '#FFFFFF'} />
          </Pressable>
        </View>

        {/* Camera Viewfinder Area */}
        <View style={styles.cameraContainer}>
          {permission?.granted ? (
            <View style={styles.cameraWrapper}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                enableTorch={torch}
                onBarcodeScanned={scannedCharger ? undefined : handleBarcodeScanned}
              />

              {/* Viewfinder Overlay Mask with Cutout */}
              <View style={styles.overlayContainer}>
                <View style={styles.viewfinderFrame}>
                  {/* Corner Targets */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />

                  {/* Active Scan Laser Line */}
                  {!scannedCharger && <View style={styles.laserLine} />}
                </View>

                <Text style={styles.viewfinderHint}>
                  Align the QR sticker at your bay within the frame
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.permissionBox}>
              <View style={styles.permissionIconCircle}>
                <QrCodeIcon size={32} color="#2563EB" />
              </View>
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionDesc}>
                Allow camera permission to scan bay QR stickers and start charging instantly.
              </Text>
              <Pressable
                style={styles.permissionBtn}
                onPress={requestPermission}
                accessibilityRole="button"
              >
                <Text style={styles.permissionBtnText}>Enable Camera</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Scanned Result or Quick Bay Shortcuts (Bottom Sheet Area) */}
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          {scannedCharger ? (
            /* Charger Bay Detected Card */
            <View style={styles.matchedCard}>
              <View style={styles.matchedCardHeader}>
                <View style={styles.matchedBayBadge}>
                  <BoltIcon size={18} color="#FFFFFF" />
                  <Text style={styles.matchedBayBadgeText}>{scannedCharger.bayNumber}</Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    scannedCharger.status === 'AVAILABLE'
                      ? styles.statusPillGreen
                      : styles.statusPillAmber,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      scannedCharger.status === 'AVAILABLE'
                        ? styles.statusDotGreen
                        : styles.statusDotAmber,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      scannedCharger.status === 'AVAILABLE'
                        ? styles.statusTextGreen
                        : styles.statusTextAmber,
                    ]}
                  >
                    {scannedCharger.status === 'AVAILABLE' ? 'Ready to Plug In' : 'Currently in Use'}
                  </Text>
                </View>
              </View>

              <Text style={styles.matchedChargerName}>{scannedCharger.name}</Text>
              <Text style={styles.matchedChargerSpecs}>
                {scannedCharger.connectorType} · {scannedCharger.powerKw} kW ({scannedCharger.powerType})
              </Text>

              {/* Compatibility Check */}
              <View
                style={[
                  styles.compatRow,
                  isCompatible(scannedCharger) ? styles.compatRowGood : styles.compatRowWarn,
                ]}
              >
                {isCompatible(scannedCharger) ? (
                  <>
                    <CheckCircleIcon size={16} color="#16A34A" />
                    <Text style={styles.compatTextGood}>
                      Compatible with {vehicle?.name || 'your vehicle'}
                    </Text>
                  </>
                ) : (
                  <>
                    <AlertTriangleIcon size={16} color="#D97706" />
                    <Text style={styles.compatTextWarn}>
                      Incompatible: Vehicle requires {vehicle?.connectorType || 'different plug'}
                    </Text>
                  </>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.matchedActionsRow}>
                <Pressable
                  style={styles.rescanBtn}
                  onPress={() => {
                    setScannedCharger(null);
                    setScanError(null);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.rescanBtnText}>Scan Again</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.startChargingBtn,
                    scannedCharger.status === 'OCCUPIED' && styles.startChargingBtnDisabled,
                  ]}
                  onPress={handleConfirmStart}
                  disabled={scannedCharger.status === 'OCCUPIED'}
                  accessibilityRole="button"
                >
                  <BoltIcon size={16} color="#FFFFFF" />
                  <Text style={styles.startChargingBtnText}>
                    {scannedCharger.status === 'OCCUPIED' ? 'Charger Occupied' : 'Start Charging'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Idle / Quick Bay Selection Shortcuts */
            <View style={styles.shortcutsCard}>
              {scanError && (
                <View style={styles.errorAlert}>
                  <AlertTriangleIcon size={16} color="#DC2626" />
                  <Text style={styles.errorAlertText}>{scanError}</Text>
                </View>
              )}

              <View style={styles.shortcutsHeader}>
                <Text style={styles.shortcutsTitle}>Quick Select Parking Bay</Text>
                <Text style={styles.shortcutsSub}>
                  Tap below to test or charge without scanning physical QR:
                </Text>
              </View>

              <View style={styles.bayChipsWrap}>
                <Pressable
                  style={styles.bayChip}
                  onPress={() => handleSelectPreconfiguredBay('Bay 11')}
                >
                  <View style={styles.chipBoltWrap}>
                    <BoltIcon size={12} color="#2563EB" />
                  </View>
                  <View>
                    <Text style={styles.bayChipTitle}>Bay 11 (2W)</Text>
                    <Text style={styles.bayChipSub}>15A Socket · 3.3 kW</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.bayChip}
                  onPress={() => handleSelectPreconfiguredBay('Bay 12')}
                >
                  <View style={styles.chipBoltWrap}>
                    <BoltIcon size={12} color="#2563EB" />
                  </View>
                  <View>
                    <Text style={styles.bayChipTitle}>Bay 12 (2W)</Text>
                    <Text style={styles.bayChipSub}>15A Socket · 3.3 kW</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.bayChip}
                  onPress={() => handleSelectPreconfiguredBay('Bay 01')}
                >
                  <View style={styles.chipBoltWrap}>
                    <BoltIcon size={12} color="#16A34A" />
                  </View>
                  <View>
                    <Text style={styles.bayChipTitle}>Bay 01 (4W)</Text>
                    <Text style={styles.bayChipSub}>Type 2 · 11 kW</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.bayChip}
                  onPress={() => handleSelectPreconfiguredBay('Bay 02')}
                >
                  <View style={styles.chipBoltWrap}>
                    <BoltIcon size={12} color="#16A34A" />
                  </View>
                  <View>
                    <Text style={styles.bayChipTitle}>Bay 02 (4W)</Text>
                    <Text style={styles.bayChipSub}>Type 2 · 11 kW</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnActive: {
    backgroundColor: '#EFF6FF',
  },
  closeIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  cameraContainer: {
    height: 310,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  cameraWrapper: {
    flex: 1,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  viewfinderFrame: {
    width: 210,
    height: 210,
    position: 'relative',
    borderRadius: 16,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  laserLine: {
    position: 'absolute',
    top: '48%',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  viewfinderHint: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500',
    marginTop: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingVertical: 5,
    borderRadius: 20,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  permissionIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  permissionDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  sheetScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  sheetContent: {
    padding: 16,
    paddingBottom: 30,
  },
  matchedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  matchedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  matchedBayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  matchedBayBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillGreen: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusPillAmber: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotGreen: {
    backgroundColor: '#16A34A',
  },
  statusDotAmber: {
    backgroundColor: '#D97706',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextGreen: {
    color: '#15803D',
  },
  statusTextAmber: {
    color: '#B45309',
  },
  matchedChargerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  matchedChargerSpecs: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  compatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  compatRowGood: {
    backgroundColor: '#F0FDF4',
  },
  compatRowWarn: {
    backgroundColor: '#FFFBEB',
  },
  compatTextGood: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  compatTextWarn: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  matchedActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rescanBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  rescanBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  startChargingBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
  },
  startChargingBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  startChargingBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shortcutsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorAlertText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  shortcutsHeader: {
    marginBottom: 12,
  },
  shortcutsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  shortcutsSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  bayChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bayChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipBoltWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bayChipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  bayChipSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
});
