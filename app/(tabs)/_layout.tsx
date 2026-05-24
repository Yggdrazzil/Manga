import { Tabs } from 'expo-router';
import React from 'react';
import { CustomTabBar } from '@/components/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Découvrir' }} />
      <Tabs.Screen name="wishlist" options={{ title: 'À lire' }} />
      <Tabs.Screen name="search" options={{ title: 'Rechercher' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
