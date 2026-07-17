import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors } from '../theme/colors';

interface ProfileSettingsRowProps {
  label: string;
  value?: string;
  onPress: () => void;
  isLast?: boolean;
}

export function ProfileSettingsRow({ label, value, onPress, isLast }: ProfileSettingsRowProps) {
  return (
    <PressableScale onPress={onPress} style={[styles.row, isLast && styles.rowLast]} scaleTo={0.98}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineAlt,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    color: colors.foreground,
    fontSize: 14,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  value: {
    color: colors.subtext,
    fontSize: 12.5,
    flexShrink: 1,
  },
  chevron: {
    color: colors.subtext,
    fontSize: 18,
  },
});
