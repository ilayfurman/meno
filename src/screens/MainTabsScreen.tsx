import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CookbookScreen } from './CookbookScreen';
import { ProfileScreen } from './ProfileScreen';
import { PressableScale } from '../components/PressableScale';
import { colors } from '../theme/colors';
import { elevation } from '../theme/elevation';
import { fontFamily } from '../theme/fonts';
import type { MainTabParamList } from '../types/navigation';

type TabKey = keyof MainTabParamList;

// Plain-text glyphs instead of an icon font: matches how the rest of the app
// already does symbols (♥ ♡ › ✦ elsewhere), and sidesteps @expo/vector-icons'
// font needing to finish loading before it paints anything.
const tabs: Array<{ key: TabKey; label: string; glyph: string }> = [
  { key: 'Cookbook', label: 'Cookbook', glyph: '▤' },
  { key: 'Profile', label: 'Profile', glyph: '◍' },
];

// Visual-refresh exploration: a flush, docked white bar with a thin top
// accent indicator on the active tab — closer to a standard native tab bar
// (Rocket Money, most iOS apps) than the floating dark pill this replaced.
// Content sits on the warm-gray canvas; the bar itself stays white and is
// separated from it purely by a soft top shadow, not a border.
export function MainTabsScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('Cookbook');
  const insets = useSafeAreaInsets();

  const content = useMemo(() => {
    return activeTab === 'Cookbook' ? <CookbookScreen /> : <ProfileScreen />;
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.content}>{content}</View>
      <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <PressableScale
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text style={[styles.tabGlyph, active && styles.tabGlyphActive]}>{tab.glyph}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flex: 1,
  },
  // Absolute + pinned to the bottom, same structural approach as the bar this
  // replaced — a normal in-flow flex sibling turned out to get clipped by an
  // ancestor's height somewhere upstream, so this sidesteps that entirely.
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingTop: 10,
    paddingHorizontal: 8,
    ...elevation.tabBar,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  tabButtonActive: {
    borderTopColor: colors.accent,
  },
  tabGlyph: {
    fontSize: 18,
    color: colors.subtext,
  },
  tabGlyphActive: {
    color: colors.accent,
  },
  tabLabel: {
    fontFamily: fontFamily.semiBold,
    color: colors.subtext,
    fontSize: 10.5,
  },
  tabLabelActive: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
  },
});
