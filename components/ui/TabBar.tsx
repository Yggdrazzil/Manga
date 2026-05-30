import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, HARD_SHADOW, RADIUS, SPACING } from '@/constants/theme';
import { Typography } from './Typography';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: Array<{ route: string; icon: IoniconName; iconActive: IoniconName; label: string }> = [
  { route: 'index', icon: 'compass-outline', iconActive: 'compass', label: 'Manga & Webtoon' },
  { route: 'wishlist', icon: 'book-outline', iconActive: 'book', label: 'BD & Comics' },
  { route: 'search', icon: 'search-outline', iconActive: 'search', label: 'Rechercher' },
  { route: 'profile', icon: 'person-circle-outline', iconActive: 'person-circle', label: 'Profil' },
];

const PILL_PADDING = 8;
const SPRING = { stiffness: 300, damping: 26 };

function TabItem({
  icon,
  iconActive,
  label,
  isFocused,
  onPress,
}: {
  icon: IoniconName;
  iconActive: IoniconName;
  label: string;
  isFocused: boolean;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(isFocused ? 1.1 : 1);

  scale.value = reducedMotion ? (isFocused ? 1.1 : 1) : withSpring(isFocused ? 1.1 : 1, SPRING);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={isFocused ? iconActive : icon}
          size={22}
          color={isFocused ? COLORS.onInk : COLORS.onInkMuted}
        />
      </Animated.View>
      {isFocused && (
        <Typography variant="caption" color={COLORS.onInk} style={styles.label}>
          {label}
        </Typography>
      )}
    </Pressable>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [pillWidth, setPillWidth] = useState(0);

  const slotWidth = pillWidth > 0 ? (pillWidth - PILL_PADDING * 2) / TABS.length : 0;
  const translateX = useSharedValue(0);

  const target = PILL_PADDING + slotWidth * state.index;
  translateX.value = reducedMotion ? target : withSpring(target, SPRING);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: slotWidth,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    setPillWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + SPACING.md }]}
      pointerEvents="box-none"
    >
      <View style={styles.pill} onLayout={onLayout}>
        {slotWidth > 0 && <Animated.View style={[styles.indicator, indicatorStyle]} />}
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const tab = TABS[index];
            if (!tab) return null;
            const isFocused = state.index === index;
            return (
              <TabItem
                key={route.key}
                {...tab}
                isFocused={isFocused}
                onPress={() => {
                  if (!isFocused) {
                    Haptics.selectionAsync();
                    navigation.navigate(route.name);
                  }
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: SPACING.base,
    right: SPACING.base,
  },
  pill: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.full,
    paddingHorizontal: PILL_PADDING,
    overflow: 'visible',
    ...HARD_SHADOW,
  },
  indicator: {
    position: 'absolute',
    top: PILL_PADDING,
    bottom: PILL_PADDING,
    backgroundColor: COLORS.accentRed,
    borderRadius: RADIUS.full,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 9,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
