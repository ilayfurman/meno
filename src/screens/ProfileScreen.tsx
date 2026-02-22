import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useAppContext } from '../navigation/AppContext';
import { clearCookbook } from '../storage/cookbook';
import { defaultPreferences } from '../storage/preferences';
import type { RootStackParamList } from '../types/navigation';

function SettingsRow({ label, subtitle, onPress }: { label: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [dangerOpen, setDangerOpen] = useState(false);
  const { setPreferences, userProfile, billing } = useAppContext();

  const resetPreferences = () => {
    setPreferences({ ...defaultPreferences, onboardingComplete: true });
    Alert.alert('Reset complete', 'Preferences reset. Cookbook recipes were kept.');
  };

  const clearAll = () => {
    Alert.alert('Delete all data', 'This clears preferences and all saved cookbook recipes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setPreferences({ ...defaultPreferences, onboardingComplete: true });
          void clearCookbook();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.section}>
        <SettingsRow label="Account" subtitle={`${userProfile.name} · ${userProfile.email}`} onPress={() => navigation.navigate('Account')} />
        <SettingsRow label="Food Preferences" subtitle="Dietary, allergies, cuisine, spice" onPress={() => navigation.navigate('FoodPreferences')} />
        <SettingsRow label="Billing & Plan" subtitle={`Current plan: ${billing.plan}`} onPress={() => navigation.navigate('Billing')} />
        <SettingsRow label="Support" subtitle="Help, terms, privacy" onPress={() => navigation.navigate('Support')} />
      </View>

      <View style={styles.inlineActions}>
        <Pressable style={styles.pill} onPress={resetPreferences}>
          <Text style={styles.pillText}>Reset preferences</Text>
        </Pressable>
      </View>

      <View style={styles.dangerZone}>
        <Pressable style={styles.dangerHeader} onPress={() => setDangerOpen((v) => !v)}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <Text style={styles.chevron}>{dangerOpen ? '⌄' : '›'}</Text>
        </Pressable>
        {dangerOpen ? (
          <View style={styles.dangerBody}>
            <Pressable onPress={clearAll}>
              <Text style={styles.deleteText}>Delete all data</Text>
            </Pressable>
            <Text style={styles.helper}>Removes saved recipes and resets all preferences.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 22,
    marginLeft: 10,
  },
  inlineActions: {
    flexDirection: 'row',
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  pillText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  dangerZone: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  dangerHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dangerTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  dangerBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
