import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CookbookScreen } from './CookbookScreen';
import { ProfileScreen } from './ProfileScreen';
import { PressableScale } from '../components/PressableScale';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { MainTabParamList } from '../types/navigation';

type TabKey = keyof MainTabParamList;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'Cookbook', label: 'Cookbook' },
  { key: 'Profile', label: 'Profile' },
];

export function MainTabsScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('Cookbook');
  const insets = useSafeAreaInsets();

  const content = useMemo(() => {
    return activeTab === 'Cookbook' ? <CookbookScreen /> : <ProfileScreen />;
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.content}>{content}</View>
      <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <PressableScale key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tabButton}>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.foreground,
    borderRadius: spacing.radiusPill,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  tabButton: {
    paddingHorizontal: 22,
    paddingVertical: 4,
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '800',
  },
});
