import { useAuth } from '@/context/AuthContext';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OtpScreen() {
  const { mobile = '' } = useLocalSearchParams<{ mobile?: string }>();
  const { isRegisteredUser, login } = useAuth();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(59);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (digit && index === 5) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (event: any, index: number) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

const handleVerify = async () => {
    const enteredOtp = otp.join('');

    if (enteredOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
      return;
    }

    if (enteredOtp === '123456') {
      const cleanMobile = mobile.trim();
      const exists = isRegisteredUser(cleanMobile);

      if (exists) {
        await login(cleanMobile);
        router.replace('/home');
      } else {
        router.push({
          pathname: '/register',
          params: { mobile: cleanMobile },
        });
      }
    } else {
      Alert.alert('Invalid OTP', 'For testing, use OTP: 123456');
    }
  };

  const handleResend = () => {
    if (timer > 0) return;
    setTimer(59);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    Alert.alert('OTP Sent', `A new OTP has been sent to +91 ${mobile}.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>✓</Text>
          </View>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>We sent a 6-digit verification code to</Text>
          <Text style={styles.mobile}>+91 {mobile}</Text>
        </View>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
              value={digit}
              onChangeText={(value) => handleChange(value, index)}
              onKeyPress={(event) => handleKeyPress(event, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        <Text style={styles.timer}>
          OTP expires in 00:{timer < 10 ? `0${timer}` : timer}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.verifyButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleVerify}
        >
          <Text style={styles.verifyText}>Verify & Continue</Text>
        </Pressable>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          <Pressable onPress={handleResend} disabled={timer > 0}>
            <Text style={[styles.resendLink, timer > 0 && styles.resendDisabled]}>
              Resend OTP
            </Text>
          </Pressable>
        </View>

        <View style={styles.testBox}>
          <Text style={styles.testTitle}>Development Mode</Text>
          <Text style={styles.testText}>Test OTP: 123456</Text>
          <Text style={styles.testSubText}>
            {isRegisteredUser(mobile)
              ? 'Status: Registered User (will open Home)'
              : 'Status: New User (will open Register)'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  backText: { fontSize: 32, color: '#374151', lineHeight: 30 },
  backLabel: { fontSize: 15, color: '#374151', marginLeft: 5 },
  header: { alignItems: 'center', marginTop: 35 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: { fontSize: 32, fontWeight: '700', color: '#2563EB' },
  title: { fontSize: 30, fontWeight: '700', color: '#111827', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  mobile: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 5 },
  otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 40 },
  otpInput: {
    width: 46,
    height: 56,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  otpInputFilled: { borderColor: '#2563EB' },
  timer: { marginTop: 20, fontSize: 13, color: '#6B7280' },
  verifyButton: {
    width: '100%',
    maxWidth: 430,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  buttonPressed: { opacity: 0.8 },
  verifyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  resendContainer: { flexDirection: 'row', marginTop: 25 },
  resendText: { fontSize: 14, color: '#6B7280' },
  resendLink: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  resendDisabled: { color: '#9CA3AF' },
  testBox: {
    marginTop: 35,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    width: '100%',
    maxWidth: 430,
    alignItems: 'center',
  },
  testTitle: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  testText: { marginTop: 4, fontSize: 13, color: '#374151' },
  testSubText: { marginTop: 4, fontSize: 12, color: '#2563EB', fontWeight: '500' },
});