import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../constants/theme';
import { OptionChip } from '../components/OptionChip';
import { PrimaryButton } from '../components/PrimaryButton';
import { difficultyOptions, timeOptions, vibeOptions, type DifficultyOption, type TimeOption, type VibeOption } from '../types';
import { generateRecipes } from '../ai/openai';
import type { RootStackParamList } from '../types/navigation';
import { useAppContext } from '../navigation/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [time, setTime] = useState<TimeOption>(30);
  const [vibe, setVibe] = useState<VibeOption>('comfort');
  const [difficulty, setDifficulty] = useState<DifficultyOption>('easy');
  const [loading, setLoading] = useState(false);
  const { preferences } = useAppContext();

  const onGenerate = async () => {
    try {
      setLoading(true);
      const request = { time, vibe, difficulty };
      const recipes = await generateRecipes({ preferences, request, count: 3 });
      navigation.navigate('Results', {
        recipes,
        request,
        requestId: String(Date.now()),
      });
    } catch (error) {
      Alert.alert('Generation failed', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hero}>Dinner decided in 10 seconds</Text>

      <Text style={styles.label}>Time</Text>
      <View style={styles.row}>
        {timeOptions.map((item) => (
          <OptionChip key={item} label={`${item}`} selected={time === item} onPress={() => setTime(item)} />
        ))}
      </View>

      <Text style={styles.label}>Vibe</Text>
      <View style={styles.rowWrap}>
        {vibeOptions.map((item) => (
          <OptionChip key={item} label={item} selected={vibe === item} onPress={() => setVibe(item)} />
        ))}
      </View>

      <Text style={styles.label}>Difficulty</Text>
      <View style={styles.row}>
        {difficultyOptions.map((item) => (
          <OptionChip key={item} label={item} selected={difficulty === item} onPress={() => setDifficulty(item)} />
        ))}
      </View>

      <PrimaryButton title="Generate 3 options" onPress={onGenerate} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 14,
  },
  hero: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
