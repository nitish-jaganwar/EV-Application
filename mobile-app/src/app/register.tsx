import { useAuth } from '@/context/AuthContext';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [residentType, setResidentType] = useState<'OWNER' | 'TENANT' | null>(null);

  const handleContinue = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Required', 'Please enter a valid email address.');
      return;
    }

    if (!residentType) {
      Alert.alert('Required', 'Please select Owner or Tenant.');
      return;
    }

    await register({
      fullName: fullName.trim(),
      email: email.trim(),
      mobile: mobile || '8305763637',
      residentType,
      flatNumber: 'Tower A - 402',
    });

    router.replace('/home');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>👤</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Tell us a little about yourself</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.mobileBox}>
            <Text style={styles.countryCode}>🇮🇳 +91</Text>
            <View style={styles.divider} />
            <Text style={styles.mobileText}>{mobile || '8305763637'}</Text>
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

          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleContinue}
          >
            <Text style={styles.continueText}>Complete Registration</Text>
          </Pressable>
        </View>

        <Text style={styles.securityText}>
          🔒 Your information is securely protected
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 30 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backArrow: { fontSize: 32, color: '#374151', lineHeight: 30 },
  backText: { fontSize: 15, color: '#374151', marginLeft: 5 },
  header: { alignItems: 'center', marginTop: 30, marginBottom: 25 },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 28 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B7280' },
  card: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 14 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  mobileBox: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
  },
  countryCode: { fontSize: 15, fontWeight: '600', color: '#374151' },
  divider: { width: 1, height: 24, backgroundColor: '#D1D5DB', marginHorizontal: 12 },
  mobileText: { fontSize: 15, color: '#374151' },
  typeContainer: { flexDirection: 'row', gap: 12 },
  typeButton: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  typeButtonSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioSelected: { borderColor: '#2563EB' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB' },
  typeText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  typeTextSelected: { color: '#2563EB', fontWeight: '700' },
  continueButton: {
    height: 54,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  buttonPressed: { opacity: 0.8 },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  securityText: { textAlign: 'center', marginTop: 22, fontSize: 12, color: '#9CA3AF' },
});