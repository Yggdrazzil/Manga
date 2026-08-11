import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Typography } from '@/components/ui/Typography';
import { BORDERS, COLORS, RADIUS, SPACING, themedStyles } from '@/constants/theme';
import {
  isLockEnabled,
  requestUnlock,
  shouldRelock,
  type LockResult,
} from '@/lib/utils/appLock';

/**
 * Interpose un écran de déverrouillage devant l'application.
 *
 * Principes :
 * - Ne jamais enfermer l'utilisateur dehors. Si le matériel devient
 *   indisponible (biométrie retirée des réglages système), on laisse passer
 *   plutôt que de rendre la bibliothèque inaccessible.
 * - Ne pas redemander l'authentification pour un aller-retour de deux
 *   secondes vers une notification : délai de grâce de 30 s.
 * - Masquer le contenu pendant que l'app est en arrière-plan, pour que la
 *   vignette de l'aperçu des applications ne dévoile pas la bibliothèque.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  // null = on ne sait pas encore si le verrou est actif
  const [locked, setLocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<LockResult | null>(null);
  const [obscured, setObscured] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    setBusy(true);
    const result = await requestUnlock();
    setLastResult(result);
    // 'unavailable' : le verrou était activé mais la biométrie a disparu des
    // réglages système. On ouvre l'app plutôt que de la rendre inutilisable.
    if (result === 'success' || result === 'unavailable') setLocked(false);
    setBusy(false);
  }, []);

  // État initial : verrouillé seulement si l'utilisateur l'a demandé.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const enabled = await isLockEnabled();
      if (cancelled) return;
      setLocked(enabled);
      if (enabled) void unlock();
    })();
    return () => { cancelled = true; };
  }, [unlock]);

  // Re-verrouillage au retour d'arrière-plan, passé le délai de grâce.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setObscured(false);
        const wasAt = backgroundedAt.current;
        backgroundedAt.current = null;
        if (!shouldRelock(wasAt, Date.now())) return;
        void (async () => {
          if (!(await isLockEnabled())) return;
          setLocked(true);
          void unlock();
        })();
      } else {
        // 'inactive' (bascule d'app iOS) comme 'background' : on masque tout de
        // suite pour l'aperçu système.
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
        void isLockEnabled().then(enabled => { if (enabled) setObscured(true); });
      }
    });
    return () => sub.remove();
  }, [unlock]);

  // Tant qu'on ignore l'état du verrou, ne rien dévoiler.
  if (locked === null) {
    return <View style={styles.veil} />;
  }

  return (
    <View style={styles.container}>
      {children}

      {(locked || obscured) && (
        <View style={styles.overlay}>
          {locked ? (
            <MotiView
              from={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduceMotion ? { type: 'timing', duration: 0 } : { type: 'spring', stiffness: 300, damping: 26 }}
              style={styles.card}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="lock-closed" size={30} color={COLORS.onInk} />
              </View>
              <Typography variant="heading" color={COLORS.onInk} style={styles.title}>
                Bibliothèque verrouillée
              </Typography>
              <Typography variant="body" color={COLORS.onInkMuted} style={styles.subtitle}>
                {lastResult === 'failed'
                  ? 'Authentification échouée. Réessayez pour accéder à votre bibliothèque.'
                  : lastResult === 'cancelled'
                    ? 'Authentification annulée.'
                    : 'Confirmez votre identité pour continuer.'}
              </Typography>

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={() => { void unlock(); }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Déverrouiller la bibliothèque"
                accessibilityState={{ busy }}
              >
                {busy ? (
                  <ActivityIndicator color={COLORS.onInk} />
                ) : (
                  <Typography variant="bodyBold" color={COLORS.onInk}>Déverrouiller</Typography>
                )}
              </Pressable>
            </MotiView>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1 },
  veil: { flex: 1, backgroundColor: COLORS.ink },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: { alignItems: 'center', gap: SPACING.md, maxWidth: 340 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDERS.bold,
    borderColor: COLORS.lineOnInk,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', lineHeight: 22 },
  button: {
    marginTop: SPACING.sm,
    minHeight: 48,
    minWidth: 200,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
}));
