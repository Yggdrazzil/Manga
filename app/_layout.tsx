import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Fraunces_600SemiBold, Fraunces_900Black } from '@expo-google-fonts/fraunces';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyTheme, COLORS, THEMES, themedStyles } from '@/constants/theme';
import { useSettingsStore } from '@/lib/store/settings';
import {
  checkNewChaptersAndNotify,
  registerBackgroundCheck,
  unregisterBackgroundCheck,
} from '@/lib/utils/notifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLockGate } from '@/components/AppLockGate';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      // Par défaut TanStack purge un cache inactif au bout de 5 min : rouvrir
      // une fiche relançait alors toute la cascade de requêtes (et, pour une
      // BD, six appels réseau plus une réécriture du store). Trente minutes
      // rendent le retour sur une œuvre déjà consultée instantané.
      gcTime: 1000 * 60 * 30,
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

  // New-chapter notifications: check at launch and on each return to
  // foreground (throttled internally), keep the background task in sync with
  // the setting, and deep-link to the manga page when a notification is tapped.
  const notificationsEnabled = useSettingsStore(s => s.notifications);

  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;

    if (notificationsEnabled) {
      void registerBackgroundCheck();
      void checkNewChaptersAndNotify();
    } else {
      void unregisterBackgroundCheck();
    }

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active' && useSettingsStore.getState().notifications) {
        void checkNewChaptersAndNotify();
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as
        | { mangaId?: string; source?: string }
        | undefined;
      if (data?.mangaId && data?.source) {
        router.push(`/manga/${encodeURIComponent(data.mangaId)}?source=${encodeURIComponent(data.source)}` as never);
      }
    });

    return () => {
      appStateSub.remove();
      responseSub.remove();
    };
  }, [ready, notificationsEnabled]);

  if (!ready) {
    return null;
  }

  return (
    <ErrorBoundary>
    <GestureHandlerRootView key={theme} style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={THEMES[theme].mode === 'dark' ? 'light' : 'dark'} />
          {/* Le verrou enveloppe la navigation : aucun écran n'est atteignable
              tant que l'identité n'est pas confirmée, et le contenu est masqué
              dans l'aperçu système des applications. */}
          <AppLockGate>
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
          </AppLockGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper },
}));
