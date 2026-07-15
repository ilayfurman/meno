import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface TagPillProps {
  label: string;
  variant?: 'version' | 'source' | 'neutral';
}

export function TagPill({ label, variant = 'neutral' }: TagPillProps) {
  return (
    <View style={[styles.pill, variantStyles[variant].pill]}>
      <Text style={[styles.text, variantStyles[variant].text]}>{label}</Text>
    </View>
  );
}

const variantStyles = {
  version: StyleSheet.create({
    pill: { backgroundColor: '#f4e3da' },
    text: { color: colors.accent },
  }),
  source: StyleSheet.create({
    pill: { backgroundColor: '#e6ece3' },
    text: { color: colors.accent2 },
  }),
  neutral: StyleSheet.create({
    pill: { backgroundColor: colors.hairline },
    text: { color: colors.subtext },
  }),
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: spacing.radiusPill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
