import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OptionChip } from '../components/OptionChip';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { allergyOptions, type Allergy } from '../types';
import type { RootStackParamList } from '../types/navigation';
import { useAppContext } from '../navigation/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingAllergies'>;

export function OnboardingAllergiesScreen({ navigation }: Props) {
  const { preferences, setPreferences } = useAppContext();

  const toggleAllergy = (item: Allergy) => {
    const has = preferences.allergies.includes(item);
    const next = has ? preferences.allergies.filter((a) => a !== item) : [...preferences.allergies, item];
    setPreferences({ ...preferences, allergies: next });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Any allergies?</Text>
      <Text style={styles.subtitle}>Multi-select all that apply.</Text>
      <View style={styles.wrap}>
        {allergyOptions.map((item) => (
          <OptionChip
            key={item}
            label={item}
            selected={preferences.allergies.includes(item)}
            onPress={() => toggleAllergy(item)}
          />
        ))}
      </View>
      <PrimaryButton title="Next" onPress={() => navigation.navigate('OnboardingPrefs')} />
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
