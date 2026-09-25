import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { VehicleProvider } from '@/context/VehicleContext';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Dismiss the splash screen once the app is ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" hidden={false} />
      <VehicleProvider>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="otp" />
            <Stack.Screen name="register" />
            <Stack.Screen name="home" />
            <Stack.Screen name="add-vehicle" options={{ presentation: 'modal' }} />
          </Stack>
        </NotificationProvider>
      </VehicleProvider>
    </AuthProvider>
  );
}
