import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OptionChip } from '../components/OptionChip';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { updatePreferencesViaBackend } from '../api/backend';
import type { RootStackParamList } from '../types/navigation';

const dietOptions = ['Vegetarian', 'Vegan', 'Pescatarian', 'Omnivore'];

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingDiet'>;

export function OnboardingDietScreen({ navigation }: Props) {
  const [diet, setDiet] = useState<string | null>(null);

  const handleNext = () => {
    void updatePreferencesViaBackend({ diet });
    navigation.navigate('OnboardingAllergies');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set your dietary style</Text>
      <Text style={styles.subtitle}>You can edit this anytime.</Text>
      <View style={styles.wrap}>
        {dietOptions.map((item) => (
          <OptionChip key={item} label={item} selected={diet === item} onPress={() => setDiet(diet === item ? null : item)} />
        ))}
      </View>
      <PrimaryButton title="Next" onPress={handleNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
});
