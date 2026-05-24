import { Tabs } from 'expo-router';
import React from 'react';
import { CustomTabBar } from '@/components/ui/TabBar';
import { COLORS } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Découvrir' }} />
      <Tabs.Screen name="library" options={{ title: 'Bibliothèque' }} />
      <Tabs.Screen name="search" options={{ title: 'Rechercher' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
