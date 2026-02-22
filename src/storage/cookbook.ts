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

function withRecipeMetadata(recipe: Recipe): Recipe {
  return {
    ...recipe,
    recipe_family_id: recipe.recipe_family_id ?? recipe.id,
    version_number: recipe.version_number ?? 1,
    created_at: recipe.created_at ?? Date.now(),
  };
}

export async function setCookbookOrder(recipes: Recipe[]): Promise<void> {
  await setCookbook(recipes);
}

export async function saveRecipeToCookbook(recipe: Recipe): Promise<boolean> {
  const existing = await getCookbook();
  const normalized = withRecipeMetadata(recipe);
  const alreadySaved = existing.some((r) => r.id === normalized.id);
  if (alreadySaved) {
    return false;
  }
  const deduped = [normalized, ...existing.filter((r) => r.id !== normalized.id)];
  await setCookbook(deduped);
  return true;
}

interface SaveRecipeRevisionParams {
  baseRecipeId: string;
  revisedRecipe: Recipe;
  replaceBase?: boolean;
  changeNote?: string;
}

export async function saveRecipeRevision(params: SaveRecipeRevisionParams): Promise<Recipe> {
  const { baseRecipeId, revisedRecipe, replaceBase, changeNote } = params;
  const existing = await getCookbook();
  const base = existing.find((item) => item.id === baseRecipeId);

  if (!base) {
    const fallback = withRecipeMetadata({
      ...revisedRecipe,
      change_note: changeNote ?? revisedRecipe.change_note,
    });
    await setCookbook([fallback, ...existing.filter((item) => item.id !== fallback.id)]);
    return fallback;
  }

  const familyId = base.recipe_family_id ?? base.id;
  const familyVersions = existing
    .filter((item) => (item.recipe_family_id ?? item.id) === familyId)
    .map((item) => item.version_number ?? 1);
  const nextVersion = Math.max(...familyVersions, 1) + 1;

  const normalized: Recipe = {
    ...revisedRecipe,
    id: `${familyId}-v${nextVersion}-${Date.now()}`,
    recipe_family_id: familyId,
    version_number: nextVersion,
    based_on_recipe_id: base.id,
    change_note: changeNote ?? revisedRecipe.change_note,
    created_at: Date.now(),
  };

  const nextList = replaceBase
    ? [normalized, ...existing.filter((item) => item.id !== base.id)]
    : [normalized, ...existing];

  await setCookbook(nextList);
  return normalized;
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
