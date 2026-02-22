import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export interface AppliedChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function AppliedFilterChips({ chips }: { chips: AppliedChip[] }) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {chips.map((chip) => (
        <Pressable key={chip.key} onPress={chip.onRemove} style={styles.chip}>
          <Text style={styles.label}>{chip.label}</Text>
          <Text style={styles.x}>×</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  x: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});
