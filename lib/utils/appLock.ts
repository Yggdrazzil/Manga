/**
 * Verrouillage de l'application par biométrie ou code de l'appareil.
 *
 * S'appuie sur le coffre matériel du téléphone (Keychain iOS / Keystore
 * Android) via expo-local-authentication : l'app ne manipule ni ne stocke
 * jamais d'empreinte ni de code, elle demande seulement au système de
 * confirmer que le porteur est bien le propriétaire.
 *
 * Portée honnête de cette protection : elle empêche quelqu'un qui prend le
 * téléphone déverrouillé d'ouvrir la bibliothèque. Elle ne protège PAS une
 * sauvegarde extraite de l'appareil — les données restent en clair dans le
 * stockage applicatif. Un chiffrement complet demanderait un mot de passe,
 * donc un risque de perte définitive des données en cas d'oubli.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { logger } from './logger';

// La préférence vit dans le coffre sécurisé plutôt que dans AsyncStorage :
// désactiver le verrou ne doit pas se faire en éditant un fichier de
// préférences en clair.
const LOCK_KEY = 'app_lock_enabled';

export interface LockCapability {
  /** L'appareil possède le matériel nécessaire. */
  hasHardware: boolean;
  /** Une empreinte, un visage ou un code sont configurés. */
  isEnrolled: boolean;
  /** Le verrou peut réellement être proposé à l'utilisateur. */
  available: boolean;
  /** Libellé de la méthode, pour l'écran de réglages. */
  label: string;
}

function labelFor(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Reconnaissance faciale';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Empreinte digitale';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Reconnaissance de l’iris';
  return 'Code de l’appareil';
}

export async function getLockCapability(): Promise<LockCapability> {
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return {
      hasHardware,
      isEnrolled,
      available: hasHardware && isEnrolled,
      label: labelFor(types),
    };
  } catch (e) {
    logger.warn('App lock capability check failed', { error: String(e) });
    return { hasHardware: false, isEnrolled: false, available: false, label: '' };
  }
}

export async function isLockEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(LOCK_KEY)) === '1';
  } catch (e) {
    // Coffre illisible : ne jamais enfermer l'utilisateur dehors.
    logger.warn('App lock preference unreadable', { error: String(e) });
    return false;
  }
}

export async function setLockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(LOCK_KEY, '1', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(LOCK_KEY);
  }
}

export type LockResult = 'success' | 'cancelled' | 'unavailable' | 'failed';

/**
 * Demande la confirmation d'identité au système.
 *
 * `disableDeviceFallback: false` : après plusieurs échecs biométriques, le
 * système propose le code de l'appareil. Sans ce repli, une empreinte
 * temporairement illisible (doigt mouillé, écran sale) rendrait l'app
 * inaccessible.
 */
export async function requestUnlock(reason = 'Déverrouiller votre bibliothèque'): Promise<LockResult> {
  const capability = await getLockCapability();
  if (!capability.available) return 'unavailable';

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Annuler',
      disableDeviceFallback: false,
    });
    if (result.success) return 'success';
    // `error` vaut 'user_cancel' / 'system_cancel' / 'app_cancel' selon le cas.
    return /cancel/i.test(result.error ?? '') ? 'cancelled' : 'failed';
  } catch (e) {
    logger.warn('App lock authentication failed', { error: String(e) });
    return 'failed';
  }
}

/**
 * Délai de grâce avant de re-verrouiller après un passage en arrière-plan.
 * Consulter une notification ou copier un lien ne doit pas obliger à
 * s'authentifier de nouveau.
 */
export const RELOCK_AFTER_MS = 30_000;

/** Faut-il redemander l'authentification après ce passage en arrière-plan ? */
export function shouldRelock(backgroundedAt: number | null, now: number): boolean {
  if (backgroundedAt === null) return false;
  return now - backgroundedAt >= RELOCK_AFTER_MS;
}
