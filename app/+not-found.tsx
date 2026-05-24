import { Link, Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '@/constants/theme';
import { GlassButton } from '@/components/ui/GlassButton';
import { Typography } from '@/components/ui/Typography';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Introuvable' }} />
      <View style={styles.container}>
        <Typography variant="display" style={styles.code}>404</Typography>
        <Typography variant="heading" style={styles.title}>Page introuvable</Typography>
        <Typography variant="body" style={styles.sub}>
          Cette page n&apos;existe pas ou a été déplacée.
        </Typography>
        <Link href="/" asChild>
          <GlassButton label="Retour à l'accueil" variant="primary" style={styles.btn} />
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  code: { color: COLORS.accent, fontSize: 80, lineHeight: 80 },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', marginBottom: 16 },
  btn: { marginTop: 8 },
});
