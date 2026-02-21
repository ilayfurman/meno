import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../constants/theme';
import { RecipeCard } from '../components/RecipeCard';
import { getCookbook } from '../storage/cookbook';
import type { RootStackParamList } from '../types/navigation';
import type { Recipe } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Cookbook'>;

export function CookbookScreen({ navigation }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      getCookbook().then((items) => {
        if (mounted) {
          setRecipes(items);
        }
      });
      return () => {
        mounted = false;
      };
    }, []),
  );

  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cookbook</Text>
      <TextInput style={styles.input} placeholder="Search recipes" value={search} onChangeText={setSearch} />
      <View style={styles.stack}>
        {filtered.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onPress={() =>
              navigation.navigate('RecipeDetail', {
                recipe,
                requestId: 'cookbook',
                request: {
                  time: 30,
                  vibe: 'comfort',
                  difficulty: 'easy',
                },
              })
            }
          />
        ))}
      </View>
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  stack: {
    gap: 10,
  },
});
