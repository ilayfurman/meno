import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Chip } from '../components/Chip';
import { allergyOptions, cuisineOptions, dietaryRestrictionOptions, spiceLevelOptions, type Allergy } from '../types';
import { colors } from '../theme/colors';
import { useAppContext } from '../navigation/AppContext';
import { defaultPreferences } from '../storage/preferences';

export function FoodPreferencesScreen() {
  const { preferences, setPreferences } = useAppContext();

  const toggleAllergy = (item: Allergy) => {
    const has = preferences.allergies.includes(item);
    const allergies = has ? preferences.allergies.filter((a) => a !== item) : [...preferences.allergies, item];
    setPreferences({ ...preferences, allergies });
  };

  const toggleCuisine = (item: string) => {
    const has = preferences.cuisinesLiked.includes(item);
    const cuisinesLiked = has ? preferences.cuisinesLiked.filter((c) => c !== item) : [...preferences.cuisinesLiked, item];
    setPreferences({ ...preferences, cuisinesLiked });
  };

  const resetPreferences = () => {
    setPreferences({ ...defaultPreferences, onboardingComplete: true });
    Alert.alert('Reset complete', 'Food preferences reset.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Food Preferences</Text>
        <Pressable onPress={resetPreferences} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dietary preference</Text>
        <View style={styles.wrap}>
          {dietaryRestrictionOptions.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={preferences.dietaryRestriction === option}
              tone="coral"
              onPress={() => setPreferences({ ...preferences, dietaryRestriction: option })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spice level</Text>
        <View style={styles.wrap}>
          {spiceLevelOptions.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={preferences.spiceLevel === option}
              tone="coral"
              onPress={() => setPreferences({ ...preferences, spiceLevel: option })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allergies</Text>
        <View style={styles.wrap}>
          {allergyOptions.map((option) => (
            <Chip key={option} label={option} selected={preferences.allergies.includes(option)} tone="coral" onPress={() => toggleAllergy(option)} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cuisine likes</Text>
        <View style={styles.wrap}>
          {cuisineOptions.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={preferences.cuisinesLiked.includes(option)}
              tone="coral"
              onPress={() => toggleCuisine(option)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 31,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resetButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  resetText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
