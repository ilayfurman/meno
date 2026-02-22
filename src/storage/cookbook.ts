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

async function setCookbook(recipes: Recipe[]): Promise<void> {
  await AsyncStorage.setItem(COOKBOOK_KEY, JSON.stringify(recipes));
}

export async function setCookbookOrder(recipes: Recipe[]): Promise<void> {
  await setCookbook(recipes);
}

export async function saveRecipeToCookbook(recipe: Recipe): Promise<boolean> {
  const existing = await getCookbook();
  const alreadySaved = existing.some((r) => r.id === recipe.id);
  if (alreadySaved) {
    return false;
  }
  const deduped = [recipe, ...existing.filter((r) => r.id !== recipe.id)];
  await setCookbook(deduped);
  return true;
}

export async function removeRecipeFromCookbook(id: string): Promise<void> {
  const existing = await getCookbook();
  await setCookbook(existing.filter((recipe) => recipe.id !== id));
}

export async function removeRecipesFromCookbook(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  const existing = await getCookbook();
  await setCookbook(existing.filter((recipe) => !idSet.has(recipe.id)));
}

export async function moveRecipesToTop(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  const existing = await getCookbook();
  const selected = existing.filter((recipe) => idSet.has(recipe.id));
  const rest = existing.filter((recipe) => !idSet.has(recipe.id));
  await setCookbook([...selected, ...rest]);
}

export async function clearCookbook(): Promise<void> {
  await AsyncStorage.removeItem(COOKBOOK_KEY);
}
