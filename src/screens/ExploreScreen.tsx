import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const categories = ['Trending', 'Quick', 'Comfort', 'Light'];

export function ExploreScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Explore</Text>
      {categories.map((category) => (
        <View key={category} style={styles.section}>
          <Text style={styles.sectionTitle}>{category}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {Array.from({ length: 5 }).map((_, index) => (
              <View key={`${category}-${index}`} style={styles.card}>
                <Text style={styles.cardEmoji}>🍲</Text>
                <Text style={styles.cardText}>{category} pick #{index + 1}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 18,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  row: {
    gap: 10,
  },
  card: {
    width: 150,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
