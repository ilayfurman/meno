import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAppContext } from '../navigation/AppContext';
import { clearCookbook } from '../storage/cookbook';
import { defaultPreferences } from '../storage/preferences';
import { AccountScreen } from './AccountScreen';
import { FoodPreferencesScreen } from './FoodPreferencesScreen';
import { BillingScreen } from './BillingScreen';
import { SupportScreen } from './SupportScreen';

type ProfileSubscreen = 'root' | 'account' | 'food' | 'billing' | 'support';

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
  const [dangerOpen, setDangerOpen] = useState(false);
  const [subscreen, setSubscreen] = useState<ProfileSubscreen>('root');
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

  if (subscreen !== 'root') {
    return (
      <View style={styles.screen}>
        <Pressable style={styles.backRow} onPress={() => setSubscreen('root')}>
          <Text style={styles.backText}>‹ Back to Profile</Text>
        </Pressable>

        <View style={styles.subscreenWrap}>
          {subscreen === 'account' ? <AccountScreen /> : null}
          {subscreen === 'food' ? <FoodPreferencesScreen /> : null}
          {subscreen === 'billing' ? <BillingScreen /> : null}
          {subscreen === 'support' ? <SupportScreen /> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.section}>
        <SettingsRow label="Account" subtitle={`${userProfile.name} · ${userProfile.email}`} onPress={() => setSubscreen('account')} />
        <SettingsRow label="Food Preferences" subtitle="Dietary, allergies, cuisine, spice" onPress={() => setSubscreen('food')} />
        <SettingsRow label="Billing & Plan" subtitle={`Current plan: ${billing.plan}`} onPress={() => setSubscreen('billing')} />
        <SettingsRow label="Support" subtitle="Help, terms, privacy" onPress={() => setSubscreen('support')} />
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
  backRow: {
    paddingVertical: 4,
  },
  backText: {
    color: colors.primaryAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  subscreenWrap: {
    flex: 1,
    marginHorizontal: -16,
    marginBottom: -16,
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
