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

export default function HomeScreen() {
  const [mobileNumber, setMobileNumber] = useState('');

  const handleSendOTP = () => {
  const cleanNumber = mobileNumber.trim();
  console.log('SEND OTP CLICKED');
  console.log('Mobile:', cleanNumber);

  if (cleanNumber.length !== 10) {
    Alert.alert(
      'Invalid Mobile Number',
      'Please enter a valid 10-digit mobile number.'
    );
    return;
  }

  // Navigate using a formatted path string
  router.push(`/otp?mobile=${encodeURIComponent(cleanNumber)}`);
};

  const handleGoogleLogin = () => {
    Alert.alert('Google Login', 'Google authentication coming soon.');
  };

const handleRegister = () => {
  router.push('/register');
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
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/tBits.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.header}>
            <Text style={styles.appName}>tBits Plug</Text>
            <Text style={styles.title}>Welcome Back !</Text>
            <Text style={styles.subtitle}>Discover.Charge.Pay</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Mobile Number</Text>

            <View style={styles.phoneInputContainer}>
              <Text style={styles.countryCode}>🇮🇳 +91</Text>
              <View style={styles.divider} />
              <TextInput
                style={styles.phoneInput}
                value={mobileNumber}
                onChangeText={(text) => {
                  const numbersOnly = text.replace(/[^0-9]/g, '');
                  setMobileNumber(numbersOnly.slice(0, 10));
                }}
                placeholder="Enter mobile number"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="done"
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.otpButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSendOTP}
            >
              <Text style={styles.otpButtonText}>Send OTP</Text>
            </Pressable>

            <View style={styles.orContainer}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.line} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googleButtonPressed,
              ]}
              onPress={handleGoogleLogin}
            >
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIcon}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>
          </View>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>New resident?</Text>
            <Pressable onPress={handleRegister}>
              <Text style={styles.registerLink}> Create an account</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>Secure access for residents</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  keyboardView: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 35,
    paddingBottom: 30,
    alignItems: 'center',
  },
  logoContainer: { marginBottom: 0 },
  logo: { width: 100, height: 100 },
  header: { alignItems: 'center', marginBottom: 30 },
  appName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#2563EB',
    marginBottom: 12,
  },
  title: { fontSize: 30, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#6B7280', textAlign: 'center' },
  card: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 9 },
  phoneInputContainer: {
    height: 56,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  countryCode: { fontSize: 15, fontWeight: '600', color: '#374151' },
  divider: {
    width: 1,
    height: 25,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 12,
  },
  phoneInput: { flex: 1, height: '100%', fontSize: 16, color: '#111827' },
  otpButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  buttonPressed: { opacity: 0.8 },
  otpButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 22,
  },
  line: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  orText: { marginHorizontal: 12, fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  googleButton: {
    height: 56,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  googleButtonPressed: { backgroundColor: '#F9FAFB' },
  googleIconContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  googleIcon: { fontSize: 20, fontWeight: '700', color: '#4285F4' },
  googleButtonText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  registerContainer: { flexDirection: 'row', marginTop: 28, alignItems: 'center' },
  registerText: { fontSize: 14, color: '#6B7280' },
  registerLink: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  footer: { marginTop: 'auto', paddingTop: 30, fontSize: 12, color: '#9CA3AF' },
});