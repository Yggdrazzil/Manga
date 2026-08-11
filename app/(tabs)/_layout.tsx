import { Tabs } from 'expo-router';
import React from 'react';
import { CustomTabBar } from '@/components/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Sans gel, l'onglet Profil (non virtualisé) reste abonné aux stores et
        // recalcule ses agrégats hors écran à chaque chapitre coché — sur le
        // même thread que la transition en cours.
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Manga & Webtoon' }} />
      <Tabs.Screen name="wishlist" options={{ title: 'BD & Comics' }} />
      <Tabs.Screen name="search" options={{ title: 'Rechercher' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
