import React from 'react';
import { ScrollView, StyleSheet, Text, Pressable } from 'react-native';
import { colors } from '../theme/colors';

interface SegmentedControlProps<T extends string | number> {
  options: readonly T[];
  selected: T;
  onChange: (next: T) => void;
  labelFormatter?: (value: T) => string;
  tone?: 'coral' | 'sage';
}

export function SegmentedControl<T extends string | number>({
  options,
  selected,
  onChange,
  labelFormatter,
  tone = 'sage',
}: SegmentedControlProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable
            key={String(option)}
            onPress={() => onChange(option)}
            style={[styles.option, active && (tone === 'sage' ? styles.activeSage : styles.activeCoral)]}
          >
            <Text style={[styles.label, active && (tone === 'sage' ? styles.activeSageLabel : styles.activeCoralLabel)]}>
              {labelFormatter ? labelFormatter(option) : String(option)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  option: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 41 / 2.6,
    fontWeight: '600',
  },
  activeSage: {
    borderColor: colors.secondaryAccent,
    backgroundColor: colors.successSoft,
  },
  activeCoral: {
    borderColor: colors.primaryAccent,
    backgroundColor: '#FFF5F3',
  },
  activeSageLabel: {
    color: colors.secondaryAccent,
    fontWeight: '700',
  },
  activeCoralLabel: {
    color: colors.primaryAccent,
    fontWeight: '700',
  },
});
