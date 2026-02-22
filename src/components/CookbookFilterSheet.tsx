import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from './Chip';
import type { CookbookFilterState, CookbookSortKey } from '../types/cookbook';
import { cuisineOptions } from '../types';
import { colors } from '../theme/colors';

interface CookbookFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  pendingFilters: CookbookFilterState;
  setPendingFilters: (next: CookbookFilterState) => void;
  pendingSort: CookbookSortKey;
  setPendingSort: (next: CookbookSortKey) => void;
  onApply: () => void;
  onClear: () => void;
}

const quickFilters = [
  { key: 'quick', label: 'Quick <=30' },
  { key: 'comfort', label: 'Comfort' },
  { key: 'gf', label: 'GF' },
  { key: 'veg', label: 'Veg' },
  { key: 'favorites', label: 'Favorites' },
] as const;

const sortOptions: Array<{ key: CookbookSortKey; label: string }> = [
  { key: 'recent', label: 'Recently saved' },
  { key: 'title_asc', label: 'A-Z' },
  { key: 'time_asc', label: 'Time: low-high' },
  { key: 'time_desc', label: 'Time: high-low' },
];

export function CookbookFilterSheet({
  visible,
  onClose,
  pendingFilters,
  setPendingFilters,
  pendingSort,
  setPendingSort,
  onApply,
  onClear,
}: CookbookFilterSheetProps) {
  const toggleQuick = (value: (typeof quickFilters)[number]['key']) => {
    const has = pendingFilters.quick.includes(value);
    setPendingFilters({
      ...pendingFilters,
      quick: has ? pendingFilters.quick.filter((item) => item !== value) : [...pendingFilters.quick, value],
    });
  };

  const toggleDifficulty = (value: 'easy' | 'medium') => {
    const has = pendingFilters.difficulty.includes(value);
    setPendingFilters({
      ...pendingFilters,
      difficulty: has
        ? pendingFilters.difficulty.filter((item) => item !== value)
        : [...pendingFilters.difficulty, value],
    });
  };

  const toggleCuisine = (value: string) => {
    const has = pendingFilters.cuisines.includes(value);
    setPendingFilters({
      ...pendingFilters,
      cuisines: has ? pendingFilters.cuisines.filter((item) => item !== value) : [...pendingFilters.cuisines, value],
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filter & Sort</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sort by</Text>
              <View style={styles.wrap}>
                {sortOptions.map((option) => (
                  <Chip
                    key={option.key}
                    label={option.label}
                    selected={pendingSort === option.key}
                    tone="sage"
                    onPress={() => setPendingSort(option.key)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick filters</Text>
              <View style={styles.wrap}>
                {quickFilters.map((filter) => (
                  <Chip
                    key={filter.key}
                    label={filter.label}
                    selected={pendingFilters.quick.includes(filter.key)}
                    tone="coral"
                    onPress={() => toggleQuick(filter.key)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Difficulty</Text>
              <View style={styles.wrap}>
                {(['easy', 'medium'] as const).map((difficulty) => (
                  <Chip
                    key={difficulty}
                    label={difficulty}
                    selected={pendingFilters.difficulty.includes(difficulty)}
                    tone="coral"
                    onPress={() => toggleDifficulty(difficulty)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cuisine</Text>
              <View style={styles.wrap}>
                {cuisineOptions.map((cuisine) => (
                  <Chip
                    key={cuisine}
                    label={cuisine}
                    selected={pendingFilters.cuisines.includes(cuisine)}
                    tone="coral"
                    onPress={() => toggleCuisine(cuisine)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={[styles.action, styles.clear]} onPress={onClear}>
              <Text style={styles.clearText}>Clear all</Text>
            </Pressable>
            <Pressable style={[styles.action, styles.apply]} onPress={onApply}>
              <Text style={styles.applyText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  sheet: {
    maxHeight: '76%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    color: colors.textSecondary,
    fontSize: 27,
    fontWeight: '500',
  },
  content: {
    gap: 14,
    paddingBottom: 8,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: 'center',
  },
  clear: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  apply: {
    backgroundColor: colors.primaryAccent,
  },
  clearText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  applyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
