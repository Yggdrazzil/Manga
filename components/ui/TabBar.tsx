import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { Typography } from './Typography';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: Array<{ route: string; icon: IoniconName; iconActive: IoniconName; label: string }> = [
  { route: 'index', icon: 'compass-outline', iconActive: 'compass', label: 'Découvrir' },
  { route: 'library', icon: 'library-outline', iconActive: 'library', label: 'Bibliothèque' },
  { route: 'search', icon: 'search-outline', iconActive: 'search', label: 'Rechercher' },
  { route: 'profile', icon: 'person-circle-outline', iconActive: 'person-circle', label: 'Profil' },
];

function TabItem({
  icon, iconActive, label, isFocused, onPress,
}: {
  icon: IoniconName;
  iconActive: IoniconName;
  label: string;
  isFocused: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.88, { stiffness: 600, damping: 18 }, () => {
      scale.value = withSpring(1, { stiffness: 400, damping: 20 });
    });
    onPress();
  };

  return (
    <Pressable style={styles.tab} onPress={handlePress}>
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        {isFocused && <View style={styles.activeGlow} />}
        <Ionicons
          name={isFocused ? iconActive : icon}
          size={24}
          color={isFocused ? COLORS.accent : COLORS.textMuted}
        />
        <Typography
          style={[styles.tabLabel, { color: isFocused ? COLORS.accentLight : COLORS.textMuted }]}
        >
          {label}
        </Typography>
      </Animated.View>
    </Pressable>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={50} tint="dark" style={styles.blur}>
          <View style={styles.borderTop} />
          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const tab = TABS[index];
              if (!tab) return null;
              return (
                <TabItem
                  key={route.key}
                  {...tab}
                  isFocused={state.index === index}
                  onPress={() => {
                    if (state.index !== index) navigation.navigate(route.name);
                  }}
                />
              );
            })}
          </View>
        </BlurView>
      ) : (
        <View style={[styles.blur, styles.androidBg]}>
          <View style={styles.borderTop} />
          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const tab = TABS[index];
              if (!tab) return null;
              return (
                <TabItem
                  key={route.key}
                  {...tab}
                  isFocused={state.index === index}
                  onPress={() => {
                    if (state.index !== index) navigation.navigate(route.name);
                  }}
                />
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  blur: { overflow: 'hidden' },
  androidBg: { backgroundColor: 'rgba(10, 11, 20, 0.96)' },
  borderTop: {
    height: 1,
    backgroundColor: COLORS.glassBorder,
  },
  row: {
    flexDirection: 'row',
    height: 62,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    minWidth: 56,
  },
  activeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.accentMuted,
    borderRadius: RADIUS.md,
  },
  tabLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
