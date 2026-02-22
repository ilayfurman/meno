import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecipeStep } from '../types';
import { colors } from '../theme/colors';

export function StepsList({ steps }: { steps: RecipeStep[] }) {
  return (
    <View style={styles.list}>
      {steps.map((step) => (
        <Text key={`${step.idx}-${step.text}`} style={styles.row}>
          {step.idx}. {step.text}
          {step.timer_seconds ? ` (${step.timer_seconds}s)` : ''}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
});
