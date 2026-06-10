/**
 * Drop-in replacement for `import * as Haptics from 'expo-haptics'` that
 * respects the user's haptics setting. Same call signatures, gated at runtime.
 */
import * as ExpoHaptics from 'expo-haptics';
import { useSettingsStore } from '@/lib/store/settings';

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

const enabled = () => useSettingsStore.getState().haptics;

export function impactAsync(style?: ExpoHaptics.ImpactFeedbackStyle): Promise<void> {
  return enabled() ? ExpoHaptics.impactAsync(style) : Promise.resolve();
}

export function notificationAsync(type?: ExpoHaptics.NotificationFeedbackType): Promise<void> {
  return enabled() ? ExpoHaptics.notificationAsync(type) : Promise.resolve();
}

export function selectionAsync(): Promise<void> {
  return enabled() ? ExpoHaptics.selectionAsync() : Promise.resolve();
}
