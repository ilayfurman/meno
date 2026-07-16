import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CookbookScreen } from './CookbookScreen';
import { ProfileScreen } from './ProfileScreen';
import { PressableScale } from '../components/PressableScale';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamily } from '../theme/fonts';
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
              <PressableScale
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabButton, active && styles.tabButtonActive]}
              >
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
    backgroundColor: '#fff',
    borderRadius: spacing.radiusPill,
    padding: 6,
    gap: 4,
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.radiusPill,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  tabButtonActive: {
    backgroundColor: colors.foreground,
  },
  tabLabel: {
    fontFamily: fontFamily.bold,
    color: colors.subtext,
    fontSize: 11,
  },
  tabLabelActive: {
    color: '#fff',
  },
});
