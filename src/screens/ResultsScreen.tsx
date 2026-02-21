import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RecipeCard } from '../components/RecipeCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { generateRecipes } from '../ai/openai';
import type { RootStackParamList } from '../types/navigation';
import { useAppContext } from '../navigation/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export function ResultsScreen({ route, navigation }: Props) {
  const [recipes, setRecipes] = useState(route.params.recipes);
  const [loading, setLoading] = useState(false);
  const { preferences } = useAppContext();

  const regenerate = async () => {
    try {
      setLoading(true);
      const fresh = await generateRecipes({ preferences, request: route.params.request, count: 3 });
      setRecipes(fresh);
    } catch (error) {
      Alert.alert('Regenerate failed', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tonight's options</Text>
      <View style={styles.stack}>
        {recipes.map((recipe, index) => (
          <RecipeCard
            key={`${recipe.id}-${index}`}
            recipe={recipe}
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
      <PrimaryButton title="Regenerate 3" onPress={regenerate} loading={loading} />
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
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  stack: {
    gap: 12,
  },
});
