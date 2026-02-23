import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SegmentedControl } from '../components/SegmentedControl';
import { IconGridSelector, type IconGridItem } from '../components/IconGridSelector';
import { Chip } from '../components/Chip';
import { PrimaryButton } from '../components/PrimaryButton';
import { RecipeCard } from '../components/RecipeCard';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { difficultyOptions, timeOptions, type DifficultyOption, type Recipe, type RecipeSummary, type TimeOption, type VibeOption } from '../types';
import { useAppContext } from '../navigation/AppContext';
import type { RootStackParamList } from '../types/navigation';
import { buildSingleRecipeShare } from '../utils/recipeShare';
import { isBackendEnabled } from '../api/backend';

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
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [lastRunError, setLastRunError] = useState<string | null>(null);
  const {
    preferences,
    isGenerating,
    generatedRuns,
    startGenerationRun,
    cancelActiveGeneration,
    hydrateRun,
    getRecipeForRun,
    removeGeneratedRun,
    removeRecipeFromGeneratedRun,
    saveRecipe,
  } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const dietaryPreview = useMemo(() => {
    if (preferences.dietaryRestriction !== 'none') {
      return [preferences.dietaryRestriction];
    }
    return [];
  }, [preferences.dietaryRestriction]);

  const onGenerate = async () => {
    setLastRunError(null);
    try {
      const request = { time: time === 60 ? 45 : time, vibe, difficulty };
      const runId = await startGenerationRun(request);
      void hydrateRun(runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      setLastRunError(message);
      Alert.alert('Generation failed', message.includes('insufficient_quota') ? 'OpenAI billing/quota is unavailable for this key.' : message);
    }
  };

  const onSaveRecipe = async (recipeId: string) => {
    const recipe = generatedRuns
      .map((run) => run.recipesById[recipeId])
      .find((item): item is Recipe => Boolean(item));
    if (!recipe) {
      Alert.alert('Recipe still loading', 'Please wait until this recipe is fully generated.');
      return;
    }

    if (!savedIds.includes(recipeId)) {
      setSavedIds((prev) => [...prev, recipeId]);
    }

    try {
      const added = await saveRecipe(recipe);
      Alert.alert(added ? 'Saved' : 'Already saved', added ? 'Recipe added to cookbook.' : 'This recipe is already in your cookbook.');
    } catch (error) {
      setSavedIds((prev) => prev.filter((id) => id !== recipeId));
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save recipe.');
    }
  };

  const onShareRecipe = async (recipeId: string) => {
    const recipe = generatedRuns
      .map((run) => run.recipesById[recipeId])
      .find((item): item is Recipe => Boolean(item));
    if (!recipe) {
      Alert.alert('Recipe still loading', 'Please wait until this recipe is fully generated.');
      return;
    }
    try {
      await Share.share({
        title: recipe.title,
        message: buildSingleRecipeShare(recipe),
      });
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  };

  const summaryToPlaceholderRecipe = (summary: RecipeSummary): Recipe => ({
    id: summary.id,
    title: summary.title,
    cuisine: summary.cuisine,
    servings: summary.servings_hint ?? 2,
    total_time_minutes: summary.total_time_minutes,
    difficulty: summary.difficulty,
    short_hook: summary.short_hook,
    ingredients: [],
    steps: [],
    substitutions: [],
    dietary_tags: summary.dietary_tags,
    allergen_warnings: summary.allergen_warnings,
    completion_state: 'summary',
  });

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

      <PrimaryButton title="Show me 3 ideas" onPress={onGenerate} loading={isGenerating} disabled={isGenerating} />
      {isGenerating ? (
        <Pressable style={styles.stopButton} onPress={cancelActiveGeneration}>
          <Text style={styles.stopButtonText}>Stop run</Text>
        </Pressable>
      ) : null}
      {__DEV__ ? <Text style={styles.debugInfo}>Mode: {isBackendEnabled() ? 'backend' : 'client'}</Text> : null}
      {lastRunError ? <Text style={styles.errorHint}>Last error: {lastRunError}</Text> : null}

      {generatedRuns.map((run, runIndex) => (
        <View key={run.id} style={styles.runSection}>
          <View style={styles.runHeader}>
            <View>
              <Text style={styles.runTitle}>{runIndex === 0 ? 'Current results' : `Previous results ${runIndex}`}</Text>
              <Text style={styles.runMeta}>
                {new Date(run.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {' · '}
                {run.request.time} min · {run.request.vibe}
              </Text>
            </View>
            <Pressable style={styles.dismissRunButton} onPress={() => removeGeneratedRun(run.id)}>
              <Text style={styles.dismissRunText}>Dismiss run</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.runCards}>
            {run.summaries.map((summary, recipeIndex) => {
              const hydratedRecipe = getRecipeForRun(run.id, summary.id);
              const status = run.statusById[summary.id] ?? 'pending';
              const recipe = hydratedRecipe ?? summaryToPlaceholderRecipe(summary);

              return (
              <View key={`${run.id}-${summary.id}-${recipeIndex}`} style={styles.runCardWrap}>
                <RecipeCard
                  recipe={recipe}
                  compact
                  onSave={status === 'ready' && !savedIds.includes(recipe.id) ? () => void onSaveRecipe(recipe.id) : undefined}
                  onShare={status === 'ready' ? () => void onShareRecipe(recipe.id) : undefined}
                  onRemove={() => removeRecipeFromGeneratedRun(run.id, summary.id)}
                  onPress={() =>
                    navigation.navigate('RecipeDetail', {
                      recipe,
                      request: run.request,
                      requestId: run.id,
                      listIndex: recipeIndex,
                      runId: run.id,
                      sourceRecipeId: summary.id,
                    })
                  }
                />
                <Pressable
                  style={styles.statusBadge}
                  onPress={() => {
                    if (status === 'error') {
                      void hydrateRun(run.id);
                    }
                  }}
                >
                  <Text style={styles.statusBadgeText}>
                    {status === 'pending' ? 'Finishing recipe...' : status === 'error' ? 'Tap to retry later' : 'Ready'}
                  </Text>
                </Pressable>
              </View>
            )})}
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
  stopButton: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryAccent,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  stopButtonText: {
    color: colors.primaryAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  debugInfo: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  errorHint: {
    color: colors.primaryAccent,
    fontSize: 12,
  },
  runSection: {
    gap: 8,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  runTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  runMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  dismissRunButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  dismissRunText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  runCards: {
    gap: 10,
    paddingRight: 16,
  },
  runCardWrap: {
    width: 262,
    gap: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
