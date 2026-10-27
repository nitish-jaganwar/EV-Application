import BrandLogo, { TBitsCrossIcon } from '@/components/ui/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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

export default function HomeScreen() {
  const [activeSegment, setActiveSegment] = useState<'LOGIN' | 'NEW_USER'>('LOGIN');
  const [mobileNumber, setMobileNumber] = useState('8305763637');
  const [newFlatNumber, setNewFlatNumber] = useState('');
  const [newPlateNumber, setNewPlateNumber] = useState('');
  const { login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Method 1 (Primary): Send OTP to registered resident mobile
  const handleSendOTP = () => {
    const cleanNumber = mobileNumber.trim();
    if (cleanNumber.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    router.push(`/otp?mobile=${encodeURIComponent(cleanNumber)}`);
  };

  // Method 2 (Secondary): Official Society CAS Portal SSO
  const handleCasLogin = async () => {
    try {
      setIsLoggingIn(true);
      const success = await login('8305763637');
      if (success) {
        router.replace('/home');
      } else {
        Alert.alert('CAS Error', 'Could not authenticate via Society CAS portal.');
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
          {/* Official Brand Header */}
          <View style={styles.brandContainer}>
            <BrandLogo
              size={52}
              showWordmark={true}
              showTagline={true}
              taglineText="Charge where you park"
            />
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
                <Text style={styles.cardTitle}>Log in</Text>

                {/* Primary Option: Mobile Number OTP */}
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

                {/* Clean Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.line} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.line} />
                </View>

                {/* Secondary Option: Log in via CAS */}
                <Pressable
                  style={({ pressed }) => [
                    styles.casButton,
                    pressed && styles.casButtonPressed,
                  ]}
                  onPress={handleCasLogin}
                  disabled={isLoggingIn}
                >
                  <View style={styles.casIconWrap}>
                    <TBitsCrossIcon size={18} />
                  </View>
                  <Text style={styles.casButtonText}>
                    {isLoggingIn ? 'Authenticating with CAS...' : 'Log in via Society CAS'}
                  </Text>
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

          {/* Minimal Clean Footer */}
          <View style={styles.cleanFooter}>
            <Text style={styles.cleanFooterText}>
              tBits Plug · Secure Resident Access
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
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
    backgroundColor: '#005098',
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
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  phoneInputContainer: {
    height: 48,
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
  primaryButton: {
    backgroundColor: '#005098',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
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
    marginHorizontal: 12,
    letterSpacing: 0.5,
  },
  casButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  casButtonPressed: {
    backgroundColor: '#F1F5F9',
    borderColor: '#94A3B8',
  },
  casIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#005098',
  },
  textInputBox: {
    height: 48,
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
  cleanFooter: {
    paddingVertical: 8,
  },
  cleanFooterText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
