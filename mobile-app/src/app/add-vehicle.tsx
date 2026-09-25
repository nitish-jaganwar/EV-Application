import { POPULAR_EVS, useVehicle } from '@/context/VehicleContext';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BRANDS = ['All', 'Tata', 'MG', 'Hero Vida', 'Ather', 'Ola'];

export default function AddVehicleScreen() {
  const { addVehicle } = useVehicle();
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<(typeof POPULAR_EVS)[0] | null>(null);
  const [plateNumber, setPlateNumber] = useState('');

  const filteredList = POPULAR_EVS.filter((ev) => {
    const matchesBrand = selectedBrand === 'All' || ev.brand.toLowerCase() === selectedBrand.toLowerCase();
    const matchesQuery = ev.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBrand && matchesQuery;
  });

  const handleSaveVehicle = () => {
    if (!selectedModel) {
      Alert.alert('Selection Required', 'Please choose your EV model.');
      return;
    }
    if (!plateNumber.trim()) {
      Alert.alert('Registration Plate Required', 'Enter your vehicle plate number (e.g. MP04 AB 1234).');
      return;
    }

    addVehicle({
      ...selectedModel,
      plateNumber: plateNumber.trim().toUpperCase(),
    });

    Alert.alert('Vehicle Added', `${selectedModel.name} (${plateNumber.toUpperCase()}) is set as active.`);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add Vehicle</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Brand Filters */}
      <View style={styles.brandRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={BRANDS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.brandChip, selectedBrand === item && styles.brandChipActive]}
              onPress={() => setSelectedBrand(item)}
            >
              <Text style={[styles.brandText, selectedBrand === item && styles.brandTextActive]}>
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for vehicle model..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Plate Number Input */}
      <View style={styles.plateInputContainer}>
        <Text style={styles.plateLabel}>Vehicle Registration No.</Text>
        <TextInput
          style={styles.plateInput}
          placeholder="e.g. MP04 74207"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          value={plateNumber}
          onChangeText={setPlateNumber}
        />
      </View>

      {/* Model Cards Grid */}
      <FlatList
        data={filteredList}
        numColumns={2}
        keyExtractor={(item) => item.name}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selectedModel?.name === item.name;
          return (
            <Pressable
              style={[styles.card, isSelected && styles.cardActive]}
              onPress={() => setSelectedModel(item)}
            >
              <Text style={styles.cardEmoji}>{item.icon}</Text>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardSub}>
                {item.connectorType} • {item.batteryCapacityKwh} kWh
              </Text>
              {isSelected && <View style={styles.checkBadge}><Text style={styles.checkText}>✓</Text></View>}
            </Pressable>
          );
        }}
      />

      {/* Sticky Save CTA */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.addBtn, !selectedModel && styles.addBtnDisabled]}
          onPress={handleSaveVehicle}
        >
          <Text style={styles.addBtnText}>Save & Select Vehicle</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 16, color: '#2563EB', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  brandRow: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  brandChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  brandChipActive: { backgroundColor: '#FF6B50' },
  brandText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  brandTextActive: { color: '#FFFFFF' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 48,
  },
  searchIcon: { marginRight: 8, fontSize: 14 },
  searchInput: { flex: 1, height: '100%', fontSize: 14, color: '#111827' },
  plateInputContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
  },
  plateLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  plateInput: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },
  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    position: 'relative',
  },
  cardActive: { borderColor: '#FF6B50', backgroundColor: '#FFF5F3' },
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'center' },
  cardSub: { fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6B50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  addBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FF6B50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});