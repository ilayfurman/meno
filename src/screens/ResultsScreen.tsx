import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipeCard } from '../components/RecipeCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { useAppContext } from '../navigation/AppContext';
import type { RootStackParamList } from '../types/navigation';
import { buildSingleRecipeShare } from '../utils/recipeShare';
import type { Recipe, RecipeSummary } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export function ResultsScreen({ route, navigation }: Props) {
  const [activeRunId, setActiveRunId] = useState(route.params.requestId);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const {
    isGenerating,
    saveRecipe,
    generatedRuns,
    startGenerationRun,
    cancelActiveGeneration,
    hydrateRun,
    getRecipeForRun,
    removeGeneratedRun,
    removeRecipeFromGeneratedRun,
  } = useAppContext();

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

  useEffect(() => {
    const existing = generatedRuns.some((run) => run.id === route.params.requestId);
    if (!existing && route.params.recipes.length > 0) {
      void startGenerationRun(route.params.request).then((runId) => {
        setActiveRunId(runId);
        void hydrateRun(runId);
      });
    }
    setActiveRunId(route.params.requestId);
  }, [route.params.requestId, route.params.recipes, route.params.request, generatedRuns, startGenerationRun, hydrateRun]);

  const regenerate = async () => {
    try {
      const nextRunId = await startGenerationRun(route.params.request);
      void hydrateRun(nextRunId);
      setActiveRunId(nextRunId);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      Alert.alert('Regenerate failed', error instanceof Error ? error.message : 'Unexpected error');
    }
  };

  const shareRecipe = async (recipe: Recipe) => {
    try {
      await Share.share({
        title: recipe.title,
        message: buildSingleRecipeShare(recipe),
      });
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  };

  const onSaveRecipe = async (recipe: Recipe) => {
    if (!recipe) {
      return;
    }
    if (!savedIds.includes(recipe.id)) {
      setSavedIds((prev) => [...prev, recipe.id]);
    }
    try {
      const added = await saveRecipe(recipe);
      Alert.alert(added ? 'Saved' : 'Already saved', added ? 'Recipe added to cookbook.' : 'This recipe is already in your cookbook.');
    } catch (error) {
      setSavedIds((prev) => prev.filter((id) => id !== recipe.id));
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save recipe.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Keep dinner simple</Text>
      <Text style={styles.title}>Here's some ideas for tonight</Text>
      <Text style={styles.swipeHint}>Each generation is saved for this session. Swipe horizontally through each run.</Text>

      <View style={styles.list}>
        {generatedRuns.map((run, runIndex) => (
          <View key={run.id} style={[styles.runSection, activeRunId === run.id && styles.activeRunSection]}>
            <View style={styles.runHeader}>
              <View>
                <Text style={styles.runTitle}>Run {generatedRuns.length - runIndex}</Text>
                <Text style={styles.runSubtitle}>
                  {new Date(run.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  {' · '}
                  {run.request.time} min · {run.request.vibe}
                </Text>
              </View>
              <Pressable
                style={styles.dismissRunButton}
                onPress={() => {
                  removeGeneratedRun(run.id);
                  if (activeRunId === run.id && generatedRuns.length > 1) {
                    const fallback = generatedRuns.find((item) => item.id !== run.id);
                    if (fallback) {
                      setActiveRunId(fallback.id);
                    }
                  }
                }}
              >
                <Text style={styles.dismissRunText}>Dismiss run</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.horizontalCards}
            >
              {run.summaries.map((summary, recipeIndex) => {
                const fullRecipe = getRecipeForRun(run.id, summary.id);
                const recipe = fullRecipe ?? summaryToPlaceholderRecipe(summary);
                const ready = run.statusById[summary.id] === 'ready';
                return (
                <View key={`${run.id}-${summary.id}-${recipeIndex}`} style={styles.cardSlide}>
                  <RecipeCard
                    recipe={recipe}
                    onSave={ready && !savedIds.includes(recipe.id) ? () => void onSaveRecipe(recipe) : undefined}
                    onShare={ready ? () => void shareRecipe(recipe) : undefined}
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
                </View>
              )})}
            </ScrollView>
          </View>
        ))}
      </View>

      <PrimaryButton title="Regenerate ideas" onPress={regenerate} loading={isGenerating} disabled={isGenerating} />
      {isGenerating ? (
        <Pressable style={styles.stopButton} onPress={cancelActiveGeneration}>
          <Text style={styles.stopButtonText}>Stop run</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  kicker: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 54 / 2.3,
    lineHeight: 32,
    fontWeight: '600',
  },
  swipeHint: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  list: {
    gap: 14,
  },
  runSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: colors.surface,
  },
  activeRunSection: {
    borderColor: '#F2B0A9',
  },
  runHeader: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  runTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  runSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  dismissRunButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  dismissRunText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  horizontalCards: {
    paddingHorizontal: 12,
    gap: 10,
  },
  cardSlide: {
    width: 310,
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
});
