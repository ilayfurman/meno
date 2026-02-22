import React, { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipeCard } from '../components/RecipeCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { generateRecipes } from '../ai/openai';
import { useAppContext } from '../navigation/AppContext';
import type { RootStackParamList } from '../types/navigation';
import { buildSingleRecipeShare } from '../utils/recipeShare';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export function ResultsScreen({ route, navigation }: Props) {
  const [recipes, setRecipes] = useState(route.params.recipes);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { preferences, saveRecipe } = useAppContext();

  const regenerate = async () => {
    try {
      setLoading(true);
      const next = await generateRecipes({ preferences, request: route.params.request, count: 3 });
      setRecipes(next);
    } catch (error) {
      Alert.alert('Regenerate failed', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const shareRecipe = async (index: number) => {
    const recipe = recipes[index];
    try {
      await Share.share({
        title: recipe.title,
        message: buildSingleRecipeShare(recipe),
      });
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  };

  const onSaveRecipe = async (recipeId: string) => {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe) {
      return;
    }
    const added = await saveRecipe(recipe);
    if (added) {
      setSavedIds((prev) => [...prev, recipeId]);
      Alert.alert('Saved', 'Recipe added to cookbook.');
      return;
    }
    setSavedIds((prev) => (prev.includes(recipeId) ? prev : [...prev, recipeId]));
    Alert.alert('Already saved', 'This recipe is already in your cookbook.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Keep dinner simple</Text>
      <Text style={styles.title}>Here's some ideas for tonight</Text>
      <Text style={styles.swipeHint}>Tip: tap Save on any card to keep it in Cookbook.</Text>

      <View style={styles.list}>
        {recipes.map((recipe, index) => (
          <RecipeCard
            key={`${recipe.id}-${index}`}
            recipe={recipe}
            onSave={savedIds.includes(recipe.id) ? undefined : () => void onSaveRecipe(recipe.id)}
            onShare={() => void shareRecipe(index)}
            onPress={() =>
              navigation.navigate('RecipeDetail', {
                recipe,
                request: route.params.request,
                requestId: route.params.requestId,
                listIndex: index,
              })
            }
          />
        ))}
      </View>

      <PrimaryButton title="Regenerate ideas" onPress={regenerate} loading={loading} />
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
    gap: 12,
  },
});
