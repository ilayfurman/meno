import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OptionChip } from '../components/OptionChip';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { updatePreferencesViaBackend } from '../api/backend';
import type { RootStackParamList } from '../types/navigation';

const avoidOptions = ['No Nuts', 'No Dairy', 'No Gluten', 'No Shellfish'];

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingAllergies'>;

export function OnboardingAllergiesScreen({ navigation }: Props) {
  const [avoid, setAvoid] = useState<string[]>([]);

  const toggle = (item: string) => {
    setAvoid((prev) => (prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]));
  };

  const handleNext = () => {
    void updatePreferencesViaBackend({ avoid });
    navigation.navigate('OnboardingPrefs');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Anything to avoid?</Text>
      <Text style={styles.subtitle}>Multi-select all that apply.</Text>
      <View style={styles.wrap}>
        {avoidOptions.map((item) => (
          <OptionChip key={item} label={item} selected={avoid.includes(item)} onPress={() => toggle(item)} />
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
