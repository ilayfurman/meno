import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AccordionSection } from '../components/AccordionSection';
import { IngredientsList } from '../components/IngredientsList';
import { StepsList } from '../components/StepsList';
import { SubstitutionsList } from '../components/SubstitutionsList';
import { BottomActionBar } from '../components/BottomActionBar';
import { Chip } from '../components/Chip';
import { colors } from '../theme/colors';
import { generateRecipes } from '../ai/openai';
import { useAppContext } from '../navigation/AppContext';
import { getCookbook } from '../storage/cookbook';
import type { Recipe } from '../types';
import type { RootStackParamList } from '../types/navigation';
import { buildSingleRecipeShare } from '../utils/recipeShare';
import { getDisplayIngredients, type UnitSystem } from '../utils/ingredients';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeDetail'>;
const ENABLE_ADVANCED_YIELD_CONTROLS = false;

export function RecipeDetailScreen({ route }: Props) {
  const [recipe, setRecipe] = useState<Recipe>(route.params.recipe);
  const [adjustInput, setAdjustInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(route.params.requestId === 'cookbook');
  const [hasAdjustmentDraft, setHasAdjustmentDraft] = useState(false);
  const [baseRecipeId, setBaseRecipeId] = useState(route.params.recipe.id);
  const [targetServings, setTargetServings] = useState(route.params.recipe.servings);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('original');
  const { preferences, saveRecipe, saveRecipeRevision, removeRecipe, getRecipeForRun, hydrateRun } = useAppContext();
  const [isHydratingDetail, setIsHydratingDetail] = useState(route.params.recipe.completion_state === 'summary');
  const hydrationRequestedForRun = useRef<string | null>(null);

  const summaryRecipeId = route.params.sourceRecipeId ?? route.params.recipe.id;
  const runId = route.params.runId;

  const activeTargetServings = ENABLE_ADVANCED_YIELD_CONTROLS ? targetServings : recipe.servings;
  const activeUnitSystem: UnitSystem = ENABLE_ADVANCED_YIELD_CONTROLS ? unitSystem : 'original';

  const displayedIngredients = getDisplayIngredients({
    ingredients: recipe.ingredients,
    baseServings: recipe.servings,
    targetServings: activeTargetServings,
    unitSystem: activeUnitSystem,
  });

  useEffect(() => {
    let mounted = true;
    void getCookbook().then((items) => {
      if (mounted) {
        setSaved(items.some((item) => item.id === recipe.id));
      }
    });
    return () => {
      mounted = false;
    };
  }, [recipe.id]);

  useEffect(() => {
    setTargetServings(recipe.servings);
  }, [recipe.id, recipe.servings]);

  useEffect(() => {
    if (!runId) {
      return;
    }
    const maybeRecipe = getRecipeForRun(runId, summaryRecipeId);
    if (maybeRecipe) {
      setRecipe(maybeRecipe);
      setIsHydratingDetail(false);
      hydrationRequestedForRun.current = null;
      return;
    }
    if (!isHydratingDetail) {
      setIsHydratingDetail(true);
    }
    if (hydrationRequestedForRun.current !== runId) {
      hydrationRequestedForRun.current = runId;
      void hydrateRun(runId);
    }
  }, [runId, summaryRecipeId, getRecipeForRun, hydrateRun]);

  const regenerateSingle = async (instruction?: string) => {
    try {
      setLoading(true);
      const output = await generateRecipes({
        preferences,
        request: route.params.request,
        count: 1,
        swapInstruction: instruction,
        baseRecipe: recipe,
      });
      setRecipe(output[0]);
      setHasAdjustmentDraft(Boolean(instruction));
      if (instruction) {
        setAdjustInput('');
      }
    } catch (error) {
      Alert.alert('Could not regenerate', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const onShare = async () => {
    try {
      await Share.share({
        title: recipe.title,
        message: buildSingleRecipeShare(recipe),
      });
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  };

  const onSave = async () => {
    const wasSaved = saved;
    setSaved(true);
    try {
      const added = await saveRecipe(recipe);
      if (added) {
        setBaseRecipeId(recipe.id);
        Alert.alert('Saved', 'Recipe added to cookbook.');
        return;
      }
      Alert.alert('Already saved', 'This recipe is already in your cookbook.');
    } catch (error) {
      setSaved(wasSaved);
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save recipe.');
    }
  };

  const onRemove = () => {
    Alert.alert('Remove recipe', 'Remove this recipe from cookbook?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setSaved(false);
          void removeRecipe(recipe.id)
            .then(() => {
              Alert.alert('Removed', 'Recipe removed from cookbook.');
            })
            .catch((error) => {
              setSaved(true);
              Alert.alert('Remove failed', error instanceof Error ? error.message : 'Could not remove recipe.');
            });
        },
      },
    ]);
  };

  const onSaveAsVersion = async (replaceBase: boolean) => {
    try {
      const savedRevision = await saveRecipeRevision({
        baseRecipeId,
        revisedRecipe: recipe,
        replaceBase,
        changeNote: adjustInput.trim() || recipe.change_note || 'Adjusted recipe',
      });
      setRecipe(savedRevision);
      setBaseRecipeId(savedRevision.id);
      setSaved(true);
      setHasAdjustmentDraft(false);
      Alert.alert('Saved', replaceBase ? 'Recipe replaced with new version.' : 'New recipe version saved.');
    } catch (error) {
      Alert.alert('Could not save version', error instanceof Error ? error.message : 'Unexpected error');
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🥘</Text>
        </View>
        <Text style={styles.title}>{recipe.title}</Text>

        <View style={styles.metaRow}>
          <Chip label={`${recipe.total_time_minutes} min`} selected />
          <Chip label={recipe.difficulty} selected />
          <Chip label={`Serves ${activeTargetServings}`} selected />
          {recipe.version_number ? <Chip label={`v${recipe.version_number}`} selected /> : null}
        </View>

        {ENABLE_ADVANCED_YIELD_CONTROLS ? (
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>Yield</Text>
            <View style={styles.yieldControls}>
              <Pressable
                style={styles.yieldButton}
                onPress={() => setTargetServings((prev) => Math.max(1, prev - 1))}
              >
                <Text style={styles.yieldButtonText}>-</Text>
              </Pressable>
              <Text style={styles.yieldValue}>{targetServings}</Text>
              <Pressable style={styles.yieldButton} onPress={() => setTargetServings((prev) => prev + 1)}>
                <Text style={styles.yieldButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {ENABLE_ADVANCED_YIELD_CONTROLS ? (
          <View style={styles.metaRow}>
            <Chip label="Original" selected={unitSystem === 'original'} onPress={() => setUnitSystem('original')} />
            <Chip label="Metric" selected={unitSystem === 'metric'} onPress={() => setUnitSystem('metric')} />
            <Chip label="US" selected={unitSystem === 'us'} onPress={() => setUnitSystem('us')} />
          </View>
        ) : null}

        <AccordionSection title="Ingredients" initiallyOpen>
          {isHydratingDetail ? (
            <Text style={styles.loadingText}>Finishing ingredients...</Text>
          ) : (
            <IngredientsList ingredients={displayedIngredients} />
          )}
        </AccordionSection>

        <AccordionSection title="Steps" initiallyOpen>
          {isHydratingDetail ? <Text style={styles.loadingText}>Building steps...</Text> : <StepsList steps={recipe.steps} />}
        </AccordionSection>

        <AccordionSection title="Substitutions" initiallyOpen>
          {isHydratingDetail ? (
            <Text style={styles.loadingText}>Preparing substitution suggestions...</Text>
          ) : (
            <SubstitutionsList substitutions={recipe.substitutions} />
          )}
        </AccordionSection>

        <View style={styles.adjustBox}>
          <Text style={styles.adjustTitle}>Adjust this recipe</Text>
          <TextInput
            style={styles.swapInput}
            value={adjustInput}
            onChangeText={setAdjustInput}
            placeholder="e.g. make it kosher, less spicy, higher protein"
          />
          <View style={styles.adjustActions}>
            <Pressable
              style={[styles.adjustButton, (!adjustInput.trim() || loading) && styles.adjustButtonDisabled]}
              onPress={() => void regenerateSingle(adjustInput.trim())}
              disabled={!adjustInput.trim() || loading || isHydratingDetail}
            >
              <Text style={styles.adjustButtonText}>Generate adjustment</Text>
            </Pressable>
            {ENABLE_ADVANCED_YIELD_CONTROLS ? (
              <Pressable
                style={[
                  styles.adjustButtonSecondary,
                  (loading || isHydratingDetail || targetServings === recipe.servings) && styles.adjustButtonDisabled,
                ]}
                onPress={() =>
                  void regenerateSingle(
                    `Rebalance ingredient amounts and steps for ${targetServings} servings. ${adjustInput.trim()}`.trim(),
                  )
                }
                disabled={loading || isHydratingDetail || targetServings === recipe.servings}
              >
                <Text style={styles.adjustButtonSecondaryText}>Rebalance for yield</Text>
              </Pressable>
            ) : null}
            {saved && hasAdjustmentDraft ? (
              <>
                <Pressable style={styles.adjustButtonSecondary} onPress={() => void onSaveAsVersion(false)}>
                  <Text style={styles.adjustButtonSecondaryText}>Save as new version</Text>
                </Pressable>
                <Pressable style={styles.adjustButtonSecondary} onPress={() => void onSaveAsVersion(true)}>
                  <Text style={styles.adjustButtonSecondaryText}>Replace current</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <BottomActionBar
        actions={[
          saved ? { label: 'Saved', onPress: () => {}, disabled: true, tone: 'secondary' } : { label: 'Save', onPress: () => void onSave(), tone: 'primary', disabled: isHydratingDetail },
          { label: 'Share', onPress: () => void onShare(), tone: 'secondary', disabled: isHydratingDetail },
          ...(saved
            ? [{ label: 'Remove', onPress: () => onRemove(), tone: 'secondary' as const }]
            : []),
          { label: 'Regenerate', onPress: () => void regenerateSingle(), disabled: loading || isHydratingDetail, tone: 'primary' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    paddingBottom: 24,
  },
  hero: {
    height: 220,
    borderRadius: 22,
    backgroundColor: '#F1E5D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 80,
  },
  title: {
    fontSize: 33,
    color: colors.textPrimary,
    fontWeight: '600',
    lineHeight: 39,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adjustLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  yieldControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yieldButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  yieldButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: -1,
  },
  yieldValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  adjustBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    gap: 8,
  },
  adjustTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  swapInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
  },
  adjustActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  adjustButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.primaryAccent,
  },
  adjustButtonDisabled: {
    opacity: 0.5,
  },
  adjustButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  adjustButtonSecondary: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  adjustButtonSecondaryText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
