import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function SupportScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Support</Text>
      <View style={styles.list}>
        <LinkRow label="Contact support" onPress={() => Alert.alert('Coming soon', 'Support channel will be wired soon.')} />
        <LinkRow label="Terms of service" onPress={() => Alert.alert('Coming soon', 'Terms page link placeholder.')} />
        <LinkRow label="Privacy policy" onPress={() => Alert.alert('Coming soon', 'Privacy page link placeholder.')} />
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
    gap: 14,
  },
  title: {
    fontSize: 31,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  list: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 22,
  },
});
