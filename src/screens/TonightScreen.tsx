import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SegmentedControl } from '../components/SegmentedControl';
import { IconGridSelector, type IconGridItem } from '../components/IconGridSelector';
import { Chip } from '../components/Chip';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { difficultyOptions, timeOptions, type DifficultyOption, type TimeOption, type VibeOption } from '../types';
import { generateRecipes } from '../ai/openai';
import { useAppContext } from '../navigation/AppContext';
import type { RootStackParamList } from '../types/navigation';

const timeChoices = [...timeOptions, 60] as const;
const dietaryChips = ['GF', 'Vegetarian', 'Vegan', 'Dairy Free', 'Nut Free', 'Kosher'];

const vibeItems: IconGridItem[] = [
  { key: 'comfort', label: 'Comfort', icon: '🍃' },
  { key: 'fresh', label: 'Fresh', icon: '🥔' },
  { key: 'high-protein', label: 'High-Protein', icon: '🌰' },
  { key: 'light', label: 'Light', icon: '🍜' },
  { key: 'impress', label: 'Impress', icon: '🥂' },
  { key: 'kid-friendly', label: 'Kid-Friendly', icon: '🍱' },
];

export function TonightScreen() {
  const [time, setTime] = useState<TimeOption | 60>(30);
  const [vibe, setVibe] = useState<VibeOption>('comfort');
  const [difficulty, setDifficulty] = useState<DifficultyOption>('easy');
  const [loading, setLoading] = useState(false);
  const { preferences } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const dietaryPreview = useMemo(() => {
    if (preferences.dietaryRestriction !== 'none') {
      return [preferences.dietaryRestriction];
    }
    return [];
  }, [preferences.dietaryRestriction]);

  const onGenerate = async () => {
    try {
      setLoading(true);
      const request = { time: time === 60 ? 45 : time, vibe, difficulty };
      const recipes = await generateRecipes({ preferences, request, count: 3 });
      navigation.navigate('Results', { recipes, requestId: String(Date.now()), request });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      Alert.alert('Generation failed', message.includes('insufficient_quota') ? 'OpenAI billing/quota is unavailable for this key.' : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Good evening.</Text>
      <Text style={styles.title}>Let's make dinner easy</Text>

      <SegmentedControl
        options={timeChoices}
        selected={time}
        onChange={setTime}
        labelFormatter={(value) => (value === 60 ? '1 hour+' : `${value} min`)}
        tone="sage"
      />

      <IconGridSelector items={vibeItems} selected={vibe} onChange={(key) => setVibe(key as VibeOption)} tone="sage" />

      <View style={styles.group}>
        <Text style={styles.sectionLabel}>Dietary preferences</Text>
        <View style={styles.chipWrap}>
          {[...dietaryPreview, ...dietaryChips].slice(0, 6).map((chip) => (
            <Chip key={chip} label={chip} selected={chip === dietaryPreview[0]} tone="coral" />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.sectionLabel}>Difficulty</Text>
        <SegmentedControl options={difficultyOptions} selected={difficulty} onChange={setDifficulty} tone="sage" />
      </View>

      <PrimaryButton title="Show me 3 ideas" onPress={onGenerate} loading={loading} />
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
    gap: 16,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 50 / 2.8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 68 / 2.2,
    lineHeight: 42,
    fontWeight: '700',
  },
  group: {
    gap: 10,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.sectionHeader * 0.76,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
