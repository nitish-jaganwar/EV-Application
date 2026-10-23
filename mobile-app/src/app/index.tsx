import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function HomeScreen() {
  const [activeSegment, setActiveSegment] = useState<'LOGIN' | 'NEW_USER'>('LOGIN');
  const [mobileNumber, setMobileNumber] = useState('8305763637');
  const [newFlatNumber, setNewFlatNumber] = useState('');
  const [newPlateNumber, setNewPlateNumber] = useState('');
  const { login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSendOTP = () => {
    const cleanNumber = mobileNumber.trim();
    if (cleanNumber.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    router.push(`/otp?mobile=${encodeURIComponent(cleanNumber)}`);
  };

  const handleResidentQuickLogin = async () => {
    try {
      setIsLoggingIn(true);
      const success = await login('8305763637');
      if (success) {
        router.replace('/home');
      } else {
        Alert.alert('Login Error', 'Could not login with default resident profile.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleNewResidentOnboard = async () => {
    if (!newFlatNumber.trim() || !mobileNumber.trim()) {
      Alert.alert('Missing Details', 'Please enter your Flat Number and Mobile Number.');
      return;
    }
    try {
      setIsLoggingIn(true);
      const success = await login(mobileNumber.trim() || '8305763637');
      if (success) {
        router.replace('/home');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Text style={styles.boltIcon}>⚡</Text>
            </View>
            <Text style={styles.brandTitle}>tBits Plug</Text>
            <Text style={styles.brandSubtitle}>APARTMENT EV CHARGING ECOSYSTEM</Text>
          </View>

          {/* Segmented Switcher (Resident Login vs New User) */}
          <View style={styles.segmentContainer}>
            <Pressable
              style={[
                styles.segmentBtn,
                activeSegment === 'LOGIN' && styles.segmentBtnActive,
              ]}
              onPress={() => setActiveSegment('LOGIN')}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === 'LOGIN' && styles.segmentTextActive,
                ]}
              >
                Resident Login
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.segmentBtn,
                activeSegment === 'NEW_USER' && styles.segmentBtnActive,
              ]}
              onPress={() => setActiveSegment('NEW_USER')}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === 'NEW_USER' && styles.segmentTextActive,
                ]}
              >
                New Resident
              </Text>
            </Pressable>
          </View>

          {/* Card: Active Mode */}
          <View style={styles.card}>
            {activeSegment === 'LOGIN' ? (
              <>
                <Text style={styles.cardTitle}>Sign in to your Flat</Text>
                <Text style={styles.cardDesc}>
                  Access 15 live chargers at Tower A & B basement parking.
                </Text>

                {/* 1-Tap Resident Quick Access */}
                <Pressable
                  style={({ pressed }) => [
                    styles.quickAccessBtn,
                    pressed && styles.quickAccessBtnPressed,
                  ]}
                  onPress={handleResidentQuickLogin}
                  disabled={isLoggingIn}
                >
                  <View style={styles.quickAccessIconWrap}>
                    <Text style={styles.quickAccessIcon}>🏢</Text>
                  </View>
                  <View style={styles.quickAccessTextCol}>
                    <Text style={styles.quickAccessTitle}>Flat A-402 · Nitish Jaganwar</Text>
                    <Text style={styles.quickAccessSub}>Instant SSO Access · Token: FLAT_A402_NITISH</Text>
                  </View>
                  <Text style={styles.arrowIcon}>›</Text>
                </Pressable>

                <View style={styles.dividerRow}>
                  <View style={styles.line} />
                  <Text style={styles.dividerText}>OR WITH MOBILE OTP</Text>
                  <View style={styles.line} />
                </View>

                {/* Mobile Input */}
                <Text style={styles.inputLabel}>Registered Mobile Number</Text>
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.countryCode}>🇮🇳 +91</Text>
                  <View style={styles.inputDivider} />
                  <TextInput
                    style={styles.phoneInput}
                    value={mobileNumber}
                    onChangeText={(text) => {
                      const numbersOnly = text.replace(/[^0-9]/g, '');
                      setMobileNumber(numbersOnly.slice(0, 10));
                    }}
                    placeholder="Enter 10-digit number"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={10}
                    returnKeyType="done"
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleSendOTP}
                >
                  <Text style={styles.primaryButtonText}>Verify via OTP →</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>New Resident Onboarding</Text>
                <Text style={styles.cardDesc}>
                  Register your EV and flat to activate automated society billing.
                </Text>

                <Text style={styles.inputLabel}>Apartment / Flat Number</Text>
                <View style={styles.textInputBox}>
                  <TextInput
                    style={styles.textInputField}
                    value={newFlatNumber}
                    onChangeText={setNewFlatNumber}
                    placeholder="e.g. Tower B - 302"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="next"
                  />
                </View>

                <Text style={styles.inputLabel}>EV Plate Number (Optional)</Text>
                <View style={styles.textInputBox}>
                  <TextInput
                    style={styles.textInputField}
                    value={newPlateNumber}
                    onChangeText={setNewPlateNumber}
                    placeholder="e.g. MH 12 AB 4421"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    returnKeyType="next"
                  />
                </View>

                <Text style={styles.inputLabel}>Resident Mobile Number</Text>
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.countryCode}>🇮🇳 +91</Text>
                  <View style={styles.inputDivider} />
                  <TextInput
                    style={styles.phoneInput}
                    value={mobileNumber}
                    onChangeText={(text) => {
                      const numbersOnly = text.replace(/[^0-9]/g, '');
                      setMobileNumber(numbersOnly.slice(0, 10));
                    }}
                    placeholder="Enter 10-digit number"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={10}
                    returnKeyType="done"
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleNewResidentOnboard}
                >
                  <Text style={styles.primaryButtonText}>Register & Enter App ⚡</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Trust Banner Footer */}
          <View style={styles.trustBanner}>
            <Text style={styles.trustBannerIcon}>🔒</Text>
            <Text style={styles.trustBannerText}>
              CitrineOS OCPP 1.6/2.0.1 Certified · Society Maintenance Integrated
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  boltIcon: {
    fontSize: 26,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    width: '100%',
    maxWidth: 420,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#2563EB',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 18,
  },
  quickAccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  quickAccessBtnPressed: {
    backgroundColor: '#DCFCE7',
  },
  quickAccessIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  quickAccessIcon: {
    fontSize: 20,
  },
  quickAccessTextCol: {
    flex: 1,
  },
  quickAccessTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickAccessSub: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
    fontWeight: '600',
  },
  arrowIcon: {
    fontSize: 20,
    color: '#059669',
    fontWeight: '700',
    marginLeft: 6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginHorizontal: 10,
    letterSpacing: 0.5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  phoneInputContainer: {
    height: 50,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  countryCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  inputDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 10,
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  textInputBox: {
    height: 50,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    marginBottom: 14,
  },
  textInputField: {
    height: '100%',
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustBannerIcon: {
    fontSize: 14,
  },
  trustBannerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
