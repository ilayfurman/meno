import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Ingredient } from '../types';
import { colors } from '../theme/colors';

export function IngredientsList({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <View style={styles.list}>
      {ingredients.map((item, index) => (
        <Text key={`${item.name}-${index}`} style={styles.row}>
          ◻ {item.quantity} {item.unit} {item.name}
          {item.notes ? ` (${item.notes})` : ''}
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
