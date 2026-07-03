import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppStore } from '@/lib/store';
import { COLORS } from '@/lib/theme';

// Porte d'entrée : redirige vers la config serveur, la connexion ou l'app.
export default function Index() {
  const { hydrated, serverUrl, token } = useAppStore();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white }}>
        <ActivityIndicator color={COLORS.black} />
      </View>
    );
  }
  if (!serverUrl || !token) return <Redirect href="/setup" />;
  return <Redirect href="/(tabs)" />;
}
