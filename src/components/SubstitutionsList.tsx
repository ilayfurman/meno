import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecipeSubstitution } from '../types';
import { colors } from '../theme/colors';

export function SubstitutionsList({ substitutions }: { substitutions: RecipeSubstitution[] }) {
  return (
    <View style={styles.list}>
      {substitutions.map((sub, index) => (
        <Text key={`${sub.ingredient}-${index}`} style={styles.row}>
          {sub.ingredient}: {sub.substitutes.join(', ')}. {sub.notes}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
});
