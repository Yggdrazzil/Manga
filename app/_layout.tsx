import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Fraunces_600SemiBold, Fraunces_900Black } from '@expo-google-fonts/fraunces';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyTheme, COLORS, THEMES, themedStyles } from '@/constants/theme';
import { useSettingsStore } from '@/lib/store/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BebasNeue_400Regular,
    Fraunces_600SemiBold,
    Fraunces_900Black,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  const theme = useSettingsStore(s => s.theme);
  const [settingsHydrated, setSettingsHydrated] = useState(
    useSettingsStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsub = useSettingsStore.persist.onFinishHydration(() => setSettingsHydrated(true));
    return unsub;
  }, []);

  // Apply during render, before children mount, so every themedStyles factory
  // and inline COLORS read below already sees the right palette. The key on
  // GestureHandlerRootView remounts the whole tree on theme change.
  useMemo(() => applyTheme(theme), [theme]);

  const ready = (fontsLoaded || !!fontError) && settingsHydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView key={theme} style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={THEMES[theme].mode === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.paper },
              animation: 'fade_from_bottom',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="manga/[id]"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="reader/[id]"
              options={{
                headerShown: false,
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="comic/[id]"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen name="+not-found" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper },
}));
