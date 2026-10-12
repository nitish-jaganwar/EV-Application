import { useAuth } from '@/context/AuthContext';
import { useVehicle } from '@/context/VehicleContext';
import {
  VEHICLE_CATALOG,
  VehicleModelGroup,
  VehicleVariant,
} from '@/constants/vehicleCatalog';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const { mobile = '' } = useLocalSearchParams<{ mobile?: string }>();
  const { register } = useAuth();
  const { addVehicle } = useVehicle();

  // Form State
  const scrollViewRef = useRef<ScrollView>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState(mobile ? mobile.replace(/[^0-9]/g, '').slice(0, 10) : '');
  const [residentType, setResidentType] = useState<'OWNER' | 'TENANT' | null>(null);
  const [block, setBlock] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<VehicleVariant | null>(null);
  const [plateNumber, setPlateNumber] = useState('');

  // Vehicle Picker Modal State
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | '4W' | '2W'>('ALL');
  const [expandedModelIds, setExpandedModelIds] = useState<Record<string, boolean>>({
    'tata-nexon-ev': true, // Keep popular model open by default as in reference screenshot
  });

  const toggleModelExpand = (modelId: string) => {
    setExpandedModelIds((prev) => ({
      ...prev,
      [modelId]: !prev[modelId],
    }));
  };

  // Filter Catalog by Category & Search
  const filteredCatalog = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return VEHICLE_CATALOG.filter((group) => {
      const matchesCategory =
        activeCategory === 'ALL' || group.type === activeCategory;

      if (!matchesCategory) return false;

      if (!query) return true;

      const modelMatches = group.modelName.toLowerCase().includes(query);
      const brandMatches = group.brand.toLowerCase().includes(query);
      const variantMatches = group.variants.some((v) =>
        v.name.toLowerCase().includes(query)
      );

      return modelMatches || brandMatches || variantMatches;
    }).map((group) => {
      if (!query) return group;
      // If searching, keep variants that match or all if group matches
      const matchingVariants = group.variants.filter(
        (v) =>
          group.modelName.toLowerCase().includes(query) ||
          group.brand.toLowerCase().includes(query) ||
          v.name.toLowerCase().includes(query)
      );
      return {
        ...group,
        variants: matchingVariants.length > 0 ? matchingVariants : group.variants,
      };
    });
  }, [activeCategory, searchQuery]);

  const handleSelectVariant = (variant: VehicleVariant) => {
    setSelectedVariant(variant);
    setPickerModalVisible(false);
  };

  const handleCompleteRegistration = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Required', 'Please enter a valid email address.');
      return;
    }

    const cleanMobile = mobileNumber.replace(/[^0-9]/g, '');
    if (cleanMobile.length !== 10) {
      Alert.alert('Required', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!residentType) {
      Alert.alert('Required', 'Please select Owner or Tenant.');
      return;
    }

    if (!block.trim()) {
      Alert.alert('Required', 'Please enter your building block or tower (e.g. Tower A).');
      return;
    }

    if (!apartmentNumber.trim()) {
      Alert.alert('Required', 'Please enter your flat or apartment number.');
      return;
    }

    if (!selectedVariant) {
      Alert.alert('Required', 'Please select your EV model.');
      return;
    }

    if (!plateNumber.trim()) {
      Alert.alert('Required', 'Please enter your vehicle registration plate number.');
      return;
    }

    const cleanBlock = block.trim();
    const cleanApt = apartmentNumber.trim();
    const formattedFlat = `${cleanBlock} - ${cleanApt}`;
    const cleanPlate = plateNumber.trim().toUpperCase();

    // 1. Save vehicle to garage and make active
    addVehicle({
      name: selectedVariant.name,
      brand: selectedVariant.brand,
      type: selectedVariant.type,
      plateNumber: cleanPlate,
      batteryCapacityKwh: selectedVariant.batteryCapacityKwh,
      connectorType: selectedVariant.connectorType,
      icon: selectedVariant.icon,
    });

    // 2. Register profile in AuthContext
    await register({
      fullName: fullName.trim(),
      email: email.trim(),
      mobile: cleanMobile,
      residentType,
      block: cleanBlock,
      apartmentNumber: cleanApt,
      flatNumber: formattedFlat,
      vehicleModel: selectedVariant.name,
      vehiclePlateNumber: cleanPlate,
    });

    router.replace('/home');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Pressable style={styles.backButton} onPress={() => router.replace('/')}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>👤</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Register your residence & vehicle for charging access</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Section 1: Resident Details */}
            <Text style={styles.sectionHeading}>Personal Details</Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Nitish Jaganwar"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. nitish@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.mobileBox}>
              <Text style={styles.countryCode}>🇮🇳 +91</Text>
              <View style={styles.divider} />
              <TextInput
                style={styles.mobileInput}
                value={mobileNumber}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '');
                  setMobileNumber(digits.slice(0, 10));
                }}
                placeholder="Enter 10-digit mobile"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={10}
              />
              {mobileNumber.length === 10 && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>

            <Text style={styles.label}>Resident Type</Text>
            <View style={styles.typeContainer}>
              <Pressable
                style={[
                  styles.typeButton,
                  residentType === 'OWNER' && styles.typeButtonSelected,
                ]}
                onPress={() => setResidentType('OWNER')}
              >
                <View
                  style={[
                    styles.radio,
                    residentType === 'OWNER' && styles.radioSelected,
                  ]}
                >
                  {residentType === 'OWNER' && <View style={styles.radioDot} />}
                </View>
                <Text
                  style={[
                    styles.typeText,
                    residentType === 'OWNER' && styles.typeTextSelected,
                  ]}
                >
                  Owner
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.typeButton,
                  residentType === 'TENANT' && styles.typeButtonSelected,
                ]}
                onPress={() => setResidentType('TENANT')}
              >
                <View
                  style={[
                    styles.radio,
                    residentType === 'TENANT' && styles.radioSelected,
                  ]}
                >
                  {residentType === 'TENANT' && <View style={styles.radioDot} />}
                </View>
                <Text
                  style={[
                    styles.typeText,
                    residentType === 'TENANT' && styles.typeTextSelected,
                  ]}
                >
                  Tenant
                </Text>
              </Pressable>
            </View>

            {/* Section 2: Residence Details */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionHeading}>Residence Details</Text>

            <View style={styles.twoColumnRow}>
              <View style={styles.columnFlex}>
                <Text style={styles.label}>Block / Tower</Text>
                <TextInput
                  style={styles.input}
                  value={block}
                  onChangeText={setBlock}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollTo({ y: 240, animated: true });
                    }, 150);
                  }}
                  placeholder="e.g. Tower A"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.columnFlex}>
                <Text style={styles.label}>Apartment / Flat</Text>
                <TextInput
                  style={styles.input}
                  value={apartmentNumber}
                  onChangeText={setApartmentNumber}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollTo({ y: 240, animated: true });
                    }, 150);
                  }}
                  placeholder="e.g. 402"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="default"
                />
              </View>
            </View>

            {/* Section 3: Vehicle Information */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionHeading}>Vehicle Details</Text>

            <Text style={styles.label}>Electric Vehicle Model</Text>
            {selectedVariant ? (
              <View style={styles.selectedVehicleCard}>
                <View style={styles.selectedVehicleInfo}>
                  <Text style={styles.selectedVehicleIcon}>
                    {selectedVariant.icon}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedVehicleName} numberOfLines={1}>
                      {selectedVariant.name}
                    </Text>
                    <View style={styles.vehiclePillRow}>
                      <View style={styles.specBadge}>
                        <Text style={styles.specBadgeText}>
                          {selectedVariant.batteryCapacityKwh} kWh
                        </Text>
                      </View>
                      <View style={styles.specBadgeSecondary}>
                        <Text style={styles.specBadgeSecondaryText}>
                          {selectedVariant.connectorType}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <Pressable
                  style={styles.changeVehicleButton}
                  onPress={() => setPickerModalVisible(true)}
                >
                  <Text style={styles.changeVehicleText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.selectVehicleTrigger}
                onPress={() => setPickerModalVisible(true)}
              >
                <View style={styles.selectVehicleLeft}>
                  <Text style={styles.carTriggerIcon}>⚡</Text>
                  <Text style={styles.selectVehiclePlaceholder}>
                    Choose your EV model & variant
                  </Text>
                </View>
                <Text style={styles.selectVehicleArrow}>›</Text>
              </Pressable>
            )}

            <Text style={styles.label}>Vehicle Number (Plate No.)</Text>
            <View style={styles.plateInputWrapper}>
              <View style={styles.indPlateBadge}>
                <Text style={styles.indFlag}>🇮🇳</Text>
                <Text style={styles.indText}>IND</Text>
              </View>
              <TextInput
                style={styles.plateInput}
                value={plateNumber}
                onChangeText={(text) => setPlateNumber(text.toUpperCase())}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
                placeholder="e.g. MP 04 AB 1234"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                maxLength={15}
              />
            </View>

            {/* Submit CTA */}
            <Pressable
              style={({ pressed }) => [
                styles.continueButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleCompleteRegistration}
            >
              <Text style={styles.continueText}>Complete Registration</Text>
            </Pressable>
          </View>

          <Text style={styles.securityText}>
            🔒 Your information is securely stored for residential charging access
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* -------------------------------------------------------------
          VEHICLE SELECTOR MODAL (Matches Reference Screenshot)
      -------------------------------------------------------------- */}
      <Modal
        visible={pickerModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Vehicle Model</Text>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setPickerModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          {/* Category Tabs: All, Cars (4W), Scooters (2W) */}
          <View style={styles.tabBar}>
            <Pressable
              style={[
                styles.tabItem,
                activeCategory === 'ALL' && styles.tabItemActive,
              ]}
              onPress={() => setActiveCategory('ALL')}
            >
              <Text
                style={[
                  styles.tabItemText,
                  activeCategory === 'ALL' && styles.tabItemTextActive,
                ]}
              >
                All Vehicles
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabItem,
                activeCategory === '4W' && styles.tabItemActive,
              ]}
              onPress={() => setActiveCategory('4W')}
            >
              <Text
                style={[
                  styles.tabItemText,
                  activeCategory === '4W' && styles.tabItemTextActive,
                ]}
              >
                Cars (4W)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabItem,
                activeCategory === '2W' && styles.tabItemActive,
              ]}
              onPress={() => setActiveCategory('2W')}
            >
              <Text
                style={[
                  styles.tabItemText,
                  activeCategory === '2W' && styles.tabItemTextActive,
                ]}
              >
                Scooters (2W)
              </Text>
            </Pressable>
          </View>

          {/* Search Bar matching screenshot */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search Model"
              placeholderTextColor="#9CA3AF"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                style={styles.searchClearBtn}
              >
                <Text style={styles.searchClearText}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Section-wise Collapsible Vehicle List (Matches Screenshot) */}
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredCatalog.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>🔍</Text>
                <Text style={styles.emptyStateTitle}>No models found</Text>
                <Text style={styles.emptyStateSub}>
                  Try searching with a different model or brand name
                </Text>
              </View>
            ) : (
              filteredCatalog.map((group) => {
                const isExpanded =
                  expandedModelIds[group.id] || searchQuery.trim().length > 0;
                const variantCount = group.variants.length;

                return (
                  <View key={group.id} style={styles.modelSection}>
                    {/* Collapsible Section Header */}
                    <Pressable
                      style={styles.modelHeader}
                      onPress={() => toggleModelExpand(group.id)}
                    >
                      <View style={styles.modelHeaderLeft}>
                        <Text style={styles.modelEmoji}>{group.icon}</Text>
                        <Text style={styles.modelTitle}>{group.modelName}</Text>
                      </View>

                      <View style={styles.modelHeaderRight}>
                        <Text style={styles.variantCountText}>
                          {variantCount} {variantCount === 1 ? 'Variant' : 'Variants'}
                        </Text>
                        <Text
                          style={[
                            styles.chevronIcon,
                            isExpanded && styles.chevronIconExpanded,
                          ]}
                        >
                          {isExpanded ? '▲' : '▼'}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Expanded Variants List */}
                    {isExpanded && (
                      <View style={styles.variantList}>
                        {group.variants.map((variant) => {
                          const isSelected =
                            selectedVariant?.id === variant.id;

                          return (
                            <Pressable
                              key={variant.id}
                              style={({ pressed }) => [
                                styles.variantRow,
                                isSelected && styles.variantRowSelected,
                                pressed && styles.variantRowPressed,
                              ]}
                              onPress={() => handleSelectVariant(variant)}
                            >
                              <View style={styles.variantInfo}>
                                <Text
                                  style={[
                                    styles.variantName,
                                    isSelected && styles.variantNameSelected,
                                  ]}
                                >
                                  {variant.name}
                                </Text>
                                <Text style={styles.variantMeta}>
                                  {variant.batteryCapacityKwh} kWh • {variant.connectorType}
                                </Text>
                              </View>

                              {isSelected ? (
                                <View style={styles.selectedCheckBadge}>
                                  <Text style={styles.selectedCheckText}>✓</Text>
                                </View>
                              ) : (
                                <Text style={styles.selectActionArrow}>›</Text>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 220,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backArrow: { fontSize: 30, color: '#374151', lineHeight: 28 },
  backText: { fontSize: 15, color: '#374151', marginLeft: 4, fontWeight: '500' },
  header: { alignItems: 'center', marginTop: 12, marginBottom: 20 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: { fontSize: 26 },
  title: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  columnFlex: {
    flex: 1,
  },
  mobileBox: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  countryCode: { fontSize: 14, fontWeight: '600', color: '#374151' },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 10,
  },
  mobileInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: { fontSize: 11, color: '#166534', fontWeight: '700' },
  typeContainer: { flexDirection: 'row', gap: 10, marginTop: 4 },
  typeButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  typeButtonSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioSelected: { borderColor: '#2563EB' },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  typeText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  typeTextSelected: { color: '#2563EB', fontWeight: '700' },

  // Vehicle Trigger
  selectVehicleTrigger: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  selectVehicleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  carTriggerIcon: { fontSize: 18 },
  selectVehiclePlaceholder: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '600',
  },
  selectVehicleArrow: { fontSize: 20, color: '#0284C7', fontWeight: '700' },

  // Selected Vehicle Card
  selectedVehicleCard: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedVehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  selectedVehicleIcon: { fontSize: 24 },
  selectedVehicleName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  vehiclePillRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  specBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  specBadgeText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  specBadgeSecondary: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  specBadgeSecondaryText: { fontSize: 11, fontWeight: '600', color: '#4338CA' },
  changeVehicleButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  changeVehicleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Plate Input
  plateInputWrapper: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  indPlateBadge: {
    backgroundColor: '#1E3A8A',
    height: '100%',
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indFlag: { fontSize: 10 },
  indText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', marginTop: 1 },
  plateInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 1,
  },

  // Submit Button
  continueButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonPressed: { opacity: 0.85 },
  continueText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  securityText: {
    textAlign: 'center',
    marginTop: 18,
    fontSize: 11,
    color: '#9CA3AF',
    paddingHorizontal: 20,
    lineHeight: 16,
  },

  // -------------------------------------------------------------
  // MODAL STYLING (Matching Reference Screenshot)
  // -------------------------------------------------------------
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 14, color: '#64748B', fontWeight: '700' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabItemActive: {
    backgroundColor: '#2563EB',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: { fontSize: 15, marginRight: 8, color: '#64748B' },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', height: '100%' },
  searchClearBtn: { padding: 4 },
  searchClearText: { fontSize: 12, color: '#94A3B8' },

  // List
  listContent: {
    paddingBottom: 40,
  },
  modelSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  modelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modelEmoji: { fontSize: 18 },
  modelTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variantCountText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  chevronIcon: { fontSize: 10, color: '#64748B' },
  chevronIconExpanded: { color: '#2563EB' },

  // Variants Sub-list (Matching Screenshot)
  variantList: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  variantRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  variantRowPressed: {
    backgroundColor: '#E2E8F0',
  },
  variantInfo: { flex: 1, marginRight: 12 },
  variantName: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  variantNameSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
  variantMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  selectedCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCheckText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  selectActionArrow: { fontSize: 16, color: '#94A3B8' },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyStateEmoji: { fontSize: 32, marginBottom: 10 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyStateSub: { fontSize: 13, color: '#64748B', marginTop: 4 },
});