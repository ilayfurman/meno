import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Recipe } from '../types';

const COOKBOOK_KEY = 'meno:cookbook';

export async function getCookbook(): Promise<Recipe[]> {
  const raw = await AsyncStorage.getItem(COOKBOOK_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Recipe[];
  } catch {
    return [];
  }
}

export async function saveRecipeToCookbook(recipe: Recipe): Promise<void> {
  const existing = await getCookbook();
  const deduped = [recipe, ...existing.filter((r) => r.id !== recipe.id)];
  await AsyncStorage.setItem(COOKBOOK_KEY, JSON.stringify(deduped));
}
