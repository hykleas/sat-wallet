import '@/lib/polyfills';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { LockScreen } from '@/components/LockScreen';
import { WalletProvider, useWallet } from '@/context/WalletContext';
import { C } from '@/theme';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.accent, text: C.text, border: C.line },
};

function Root() {
  const { status } = useWallet();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const ready = status !== 'loading' && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="home" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="receive" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      {status === 'locked' && <LockScreen />}
      <StatusBar style="light" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <WalletProvider>
        <Root />
      </WalletProvider>
    </ThemeProvider>
  );
}
