import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ProfileSubpageHeader } from '../../components/ProfileSubpageHeader';
import { getPreferencesViaBackend, updatePreferencesViaBackend } from '../../api/backend';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/fonts';

const rows: Array<{ key: 'notify_recipe_saved' | 'notify_weekly_digest' | 'notify_product_updates'; label: string; description: string }> = [
  { key: 'notify_recipe_saved', label: 'New recipe saved', description: 'When a recipe is added to your cookbook.' },
  { key: 'notify_weekly_digest', label: 'Weekly digest', description: 'A weekly summary of your cookbook activity.' },
  { key: 'notify_product_updates', label: 'Product updates', description: 'New features and improvements to Meno.' },
];

export function NotificationsScreen() {
  const [values, setValues] = useState<Record<string, boolean>>({
    notify_recipe_saved: true,
    notify_weekly_digest: false,
    notify_product_updates: false,
  });

  useEffect(() => {
    void getPreferencesViaBackend().then(({ preferences }) => {
      setValues({
        notify_recipe_saved: preferences.notify_recipe_saved,
        notify_weekly_digest: preferences.notify_weekly_digest,
        notify_product_updates: preferences.notify_product_updates,
      });
    });
  }, []);

  const handleToggle = (key: string, next: boolean) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    void updatePreferencesViaBackend({ [key]: next });
  };

  return (
    <View style={styles.screen}>
      <ProfileSubpageHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.content}>
        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.description}>{row.description}</Text>
            </View>
            <Switch
              value={values[row.key]}
              onValueChange={(next) => handleToggle(row.key, next)}
              trackColor={{ true: colors.accent2, false: colors.hairline }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineAlt,
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  label: {
    color: colors.foreground,
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
  description: {
    color: colors.subtext,
    fontSize: 12.5,
    marginTop: 2,
  },
});
