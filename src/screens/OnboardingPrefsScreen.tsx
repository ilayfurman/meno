import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OptionChip } from '../components/OptionChip';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { cuisineOptions, spiceLevelOptions, type SpiceLevel } from '../types';
import type { RootStackParamList } from '../types/navigation';
import { useAppContext } from '../navigation/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingPrefs'>;

export function OnboardingPrefsScreen({ navigation }: Props) {
  const { preferences, setPreferences } = useAppContext();

  const toggleCuisine = (item: string) => {
    const has = preferences.cuisinesLiked.includes(item);
    const next = has ? preferences.cuisinesLiked.filter((c) => c !== item) : [...preferences.cuisinesLiked, item];
    setPreferences({ ...preferences, cuisinesLiked: next });
  };

  const setSpice = (level: SpiceLevel) => {
    setPreferences({ ...preferences, spiceLevel: level });
  };

  const finish = () => {
    setPreferences({ ...preferences, onboardingComplete: true });
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Taste preferences</Text>
      <Text style={styles.label}>Cuisines you like</Text>
      <View style={styles.wrap}>
        {cuisineOptions.map((item) => (
          <OptionChip
            key={item}
            label={item}
            selected={preferences.cuisinesLiked.includes(item)}
            onPress={() => toggleCuisine(item)}
          />
        ))}
      </View>
      <Text style={styles.label}>Spice level</Text>
      <View style={styles.wrap}>
        {spiceLevelOptions.map((item) => (
          <OptionChip key={item} label={item} selected={preferences.spiceLevel === item} onPress={() => setSpice(item)} />
        ))}
      </View>
      <PrimaryButton title="Finish" onPress={finish} />
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
});
