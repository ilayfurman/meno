import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TonightScreen } from './TonightScreen';
import { CookbookScreen } from './CookbookScreen';
import { ExploreScreen } from './ExploreScreen';
import { ProfileScreen } from './ProfileScreen';
import { colors } from '../theme/colors';
import type { MainTabParamList } from '../types/navigation';

type TabKey = keyof MainTabParamList;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'Tonight', label: 'Tonight' },
  { key: 'Cookbook', label: 'Cookbook' },
  { key: 'Explore', label: 'Explore' },
  { key: 'Profile', label: 'Profile' },
];

export function MainTabsScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('Tonight');
  const insets = useSafeAreaInsets();

  const content = useMemo(() => {
    if (activeTab === 'Tonight') {
      return <TonightScreen />;
    }
    if (activeTab === 'Cookbook') {
      return <CookbookScreen />;
    }
    if (activeTab === 'Explore') {
      return <ExploreScreen />;
    }
    return <ProfileScreen />;
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.content}>{content}</View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tabButton}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingHorizontal: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
  },
  tabLabel: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.primaryAccent,
    fontWeight: '700',
  },
});
