import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from './Chip';

interface FilterChipsRowProps<T extends string> {
  filters: readonly T[];
  selected: T;
  onSelect: (next: T) => void;
}

export function FilterChipsRow<T extends string>({ filters, selected, onSelect }: FilterChipsRowProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {filters.map((filter) => (
        <Chip key={filter} label={filter} selected={selected === filter} onPress={() => onSelect(filter)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
  },
});
