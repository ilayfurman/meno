import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProfileSubpageHeader } from '../../components/ProfileSubpageHeader';
import { Chip } from '../../components/Chip';
import { getPreferencesViaBackend, updatePreferencesViaBackend } from '../../api/backend';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const dietOptions = ['Vegetarian', 'Vegan', 'Pescatarian', 'Omnivore'];
const avoidOptions = ['No Nuts', 'No Dairy', 'No Gluten', 'No Shellfish'];

export function DietaryPreferencesScreen() {
  const [diet, setDiet] = useState<string | null>(null);
  const [avoid, setAvoid] = useState<string[]>([]);

  useEffect(() => {
    void getPreferencesViaBackend().then(({ preferences }) => {
      setDiet(preferences.diet);
      setAvoid(preferences.avoid);
    });
  }, []);

  const handleSelectDiet = (option: string) => {
    const next = diet === option ? null : option;
    setDiet(next);
    void updatePreferencesViaBackend({ diet: next });
  };

  const handleToggleAvoid = (option: string) => {
    const next = avoid.includes(option) ? avoid.filter((a) => a !== option) : [...avoid, option];
    setAvoid(next);
    void updatePreferencesViaBackend({ avoid: next });
  };

  return (
    <View style={styles.screen}>
      <ProfileSubpageHeader title="Dietary & allergies" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Diet</Text>
        <View style={styles.wrap}>
          {dietOptions.map((option) => (
            <Chip key={option} label={option} selected={diet === option} tone="sage" onPress={() => handleSelectDiet(option)} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Avoid</Text>
        <View style={styles.wrap}>
          {avoidOptions.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={avoid.includes(option)}
              tone="sage"
              onPress={() => handleToggleAvoid(option)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    gap: 12,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
