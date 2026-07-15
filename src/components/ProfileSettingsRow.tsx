import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors } from '../theme/colors';

interface ProfileSettingsRowProps {
  label: string;
  value?: string;
  onPress: () => void;
}

export function ProfileSettingsRow({ label, value, onPress }: ProfileSettingsRowProps) {
  return (
    <PressableScale onPress={onPress} style={styles.row} scaleTo={0.98}>
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
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineAlt,
  },
  label: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  value: {
    color: colors.subtext,
    fontSize: 13,
    flexShrink: 1,
  },
  chevron: {
    color: colors.subtext,
    fontSize: 18,
  },
});
