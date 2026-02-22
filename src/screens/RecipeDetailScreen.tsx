import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeDetail'>;

export function RecipeDetailScreen({ route }: Props) {
  const [recipe, setRecipe] = useState<Recipe>(route.params.recipe);
  const [swapInput, setSwapInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(route.params.requestId === 'cookbook');
  const { preferences, saveRecipe, removeRecipe } = useAppContext();

  useEffect(() => {
    let mounted = true;
    void getCookbook().then((items) => {
      if (mounted) {
        setSaved(items.some((item) => item.id === route.params.recipe.id));
      }
    });
    return () => {
      mounted = false;
    };
  }, [route.params.recipe.id]);

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
      if (instruction) {
        setSwapInput('');
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
    const added = await saveRecipe(recipe);
    if (added) {
      setSaved(true);
      Alert.alert('Saved', 'Recipe added to cookbook.');
      return;
    }
    setSaved(true);
    Alert.alert('Already saved', 'This recipe is already in your cookbook.');
  };

  const onRemove = () => {
    Alert.alert('Remove recipe', 'Remove this recipe from cookbook?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeRecipe(recipe.id).then(() => {
            setSaved(false);
            Alert.alert('Removed', 'Recipe removed from cookbook.');
          });
        },
      },
    ]);
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
          <Chip label={`Serves ${recipe.servings}`} selected />
        </View>

        <AccordionSection title="Ingredients" initiallyOpen>
          <IngredientsList ingredients={recipe.ingredients} />
        </AccordionSection>

        <AccordionSection title="Steps" initiallyOpen>
          <StepsList steps={recipe.steps} />
        </AccordionSection>

        <AccordionSection title="Substitutions" initiallyOpen>
          <SubstitutionsList substitutions={recipe.substitutions} />
        </AccordionSection>

        <TextInput
          style={styles.swapInput}
          value={swapInput}
          onChangeText={setSwapInput}
          placeholder="replace X with Y"
        />
      </ScrollView>

      <BottomActionBar
        actions={[
          saved
            ? { label: 'Saved', onPress: () => {}, disabled: true, tone: 'secondary' }
            : { label: 'Save', onPress: () => void onSave(), tone: 'primary' },
          { label: 'Share', onPress: () => void onShare(), tone: 'secondary' },
          ...(route.params.requestId === 'cookbook' && saved
            ? [{ label: 'Remove', onPress: () => onRemove(), tone: 'secondary' as const }]
            : []),
          { label: 'Swap', onPress: () => void regenerateSingle(swapInput.trim()), disabled: !swapInput.trim() || loading, tone: 'secondary' },
          { label: 'Regenerate', onPress: () => void regenerateSingle(), disabled: loading, tone: 'primary' },
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
  swapInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
  },
});
