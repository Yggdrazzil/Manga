import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, checkHealth, ApiError } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { COLORS } from '@/lib/theme';

type Step = 'server' | 'auth';

export default function Setup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { serverUrl, setServerUrl, setAuth } = useAppStore();

  const [step, setStep] = useState<Step>(serverUrl ? 'auth' : 'server');
  const [url, setUrl] = useState(serverUrl ?? '');
  const [testing, setTesting] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 'auth') return;
    api
      .get<{ needsSetup: boolean }>('/api/auth/needs-setup')
      .then((r) => setNeedsSetup(r.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, [step]);

  const test = async () => {
    setTesting(true);
    setError(null);
    setOk(false);
    try {
      await checkHealth(url);
      setOk(true);
    } catch (e) {
      setError(
        e instanceof ApiError && (e.code === 'invalid_server' || e.code === 'invalid_response')
          ? 'Réponse serveur invalide'
          : 'Serveur inaccessible',
      );
    } finally {
      setTesting(false);
    }
  };

  const proceed = () => {
    setServerUrl(url);
    setStep('auth');
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = needsSetup
        ? await api.post<{ token: string; user: any }>('/api/auth/setup', { displayName, password })
        : await api.post<{ token: string; user: any }>('/api/auth/login', { password });
      setAuth(res.token, res.user);
      router.replace('/(tabs)');
    } catch {
      setError(needsSetup ? 'Impossible de créer le compte' : 'Mot de passe incorrect');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.white }}
      contentContainerStyle={{ paddingTop: insets.top + 40, paddingHorizontal: 24, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.brand}>SerieTime</Text>

      {step === 'server' ? (
        <>
          <Text style={styles.lead}>Connectez votre application à votre serveur personnel.</Text>
          <Text style={styles.label}>URL du serveur</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor={COLORS.textSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              setOk(false);
            }}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {ok ? <Text style={styles.success}>Connexion réussie</Text> : null}
          <Pressable
            style={[styles.btnOutline, (!url || testing) && styles.disabled]}
            onPress={test}
            disabled={!url || testing}
          >
            <Text style={styles.btnOutlineText}>{testing ? 'TEST EN COURS…' : 'TESTER LA CONNEXION'}</Text>
          </Pressable>
          <Pressable style={[styles.btnYellow, !ok && styles.disabled]} onPress={proceed} disabled={!ok}>
            <Text style={styles.btnYellowText}>CONTINUER</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.lead}>
            {needsSetup === null ? 'Connexion au serveur…' : needsSetup ? 'Créez votre compte local.' : 'Connectez-vous.'}
          </Text>
          {needsSetup ? (
            <>
              <Text style={styles.label}>Nom d'affichage</Text>
              <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />
            </>
          ) : null}
          {needsSetup !== null ? (
            <>
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                style={[styles.btnYellow, (busy || !password || (needsSetup && !displayName)) && styles.disabled]}
                onPress={submit}
                disabled={busy || !password || (needsSetup && !displayName)}
              >
                <Text style={styles.btnYellowText}>{needsSetup ? 'CRÉER LE COMPTE' : 'SE CONNECTER'}</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable onPress={() => setStep('server')}>
            <Text style={styles.link}>Changer de serveur</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 34, fontWeight: '800' },
  lead: { fontSize: 17, color: COLORS.textMuted, marginTop: 24 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 28 },
  input: { borderBottomWidth: 1, borderBottomColor: COLORS.border, fontSize: 18, paddingVertical: 10, marginTop: 6 },
  error: { color: COLORS.red, fontSize: 15, marginTop: 12 },
  success: { color: COLORS.green, fontSize: 15, fontWeight: '600', marginTop: 12 },
  btnOutline: { borderWidth: 2, borderColor: COLORS.black, borderRadius: 999, paddingVertical: 15, marginTop: 36, alignItems: 'center' },
  btnOutlineText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.6 },
  btnYellow: { backgroundColor: COLORS.yellow, borderRadius: 999, paddingVertical: 15, marginTop: 16, alignItems: 'center' },
  btnYellowText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.6 },
  disabled: { opacity: 0.4 },
  link: { color: COLORS.blue, fontSize: 15, marginTop: 24 },
});
