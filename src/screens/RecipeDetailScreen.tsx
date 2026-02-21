import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { generateRecipes } from '../ai/openai';
import type { RootStackParamList } from '../types/navigation';
import type { Recipe } from '../types';
import { useAppContext } from '../navigation/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeDetail'>;

export function RecipeDetailScreen({ route }: Props) {
  const [recipe, setRecipe] = useState<Recipe>(route.params.recipe);
  const [swapInput, setSwapInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { preferences, saveRecipe } = useAppContext();

  const ingredients = useMemo(
    () => recipe.ingredients.map((item) => `${item.quantity} ${item.unit} ${item.name}${item.notes ? ` (${item.notes})` : ''}`),
    [recipe.ingredients],
  );

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

  const onSave = async () => {
    await saveRecipe(recipe);
    Alert.alert('Saved', 'Recipe added to your cookbook.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.meta}>
        {recipe.total_time_minutes}m | {recipe.difficulty} | serves {recipe.servings}
      </Text>
      <Text style={styles.hook}>{recipe.short_hook}</Text>

      <Text style={styles.section}>Ingredients</Text>
      {ingredients.map((item) => (
        <Text key={item} style={styles.body}>• {item}</Text>
      ))}

      <Text style={styles.section}>Steps</Text>
      {recipe.steps.map((step) => (
        <Text key={`${step.idx}-${step.text}`} style={styles.body}>
          {step.idx}. {step.text}
          {step.timer_seconds ? ` (${step.timer_seconds}s)` : ''}
        </Text>
      ))}

      <Text style={styles.section}>Substitutions</Text>
      {recipe.substitutions.map((sub) => (
        <Text key={sub.ingredient} style={styles.body}>
          {sub.ingredient}: {sub.substitutes.join(', ')}. {sub.notes}
        </Text>
      ))}

      <TextInput
        style={styles.input}
        placeholder="replace X with Y"
        value={swapInput}
        onChangeText={setSwapInput}
      />

      <PrimaryButton title="Save" onPress={onSave} />
      <PrimaryButton title="Regenerate" onPress={() => regenerateSingle()} loading={loading} />
      <PrimaryButton
        title="Swap ingredient"
        onPress={() => regenerateSingle(swapInput.trim())}
        disabled={!swapInput.trim()}
        loading={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 14,
    color: colors.muted,
  },
  hook: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  section: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  body: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
});
