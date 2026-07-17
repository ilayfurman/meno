import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { fontFamily } from '../theme/fonts';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'coral' | 'sage';
}

export function Chip({ label, selected = false, onPress, tone = 'coral' }: ChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && (tone === 'sage' ? styles.chipSelectedSage : styles.chipSelectedCoral)]}>
      <Text style={[styles.text, selected && (tone === 'sage' ? styles.textSelectedSage : styles.textSelectedCoral)]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chipSelectedCoral: {
    backgroundColor: '#FFF5F3',
    borderColor: colors.primaryAccent,
  },
  chipSelectedSage: {
    backgroundColor: colors.successSoft,
    borderColor: colors.secondaryAccent,
  },
  text: {
    fontSize: typography.chip,
    color: colors.textSecondary,
    fontFamily: fontFamily.medium,
  },
  textSelectedCoral: {
    color: colors.primaryAccent,
    fontFamily: fontFamily.bold,
  },
  textSelectedSage: {
    color: colors.secondaryAccent,
    fontFamily: fontFamily.bold,
  },
});
