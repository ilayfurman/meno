import type {
  GenerationRequest,
  Ingredient,
  Recipe,
  RecipeStep,
  RecipeSummary,
  StoredRecipe,
  UserPreferences,
  UserPreferencesV2,
} from '../types';
import { API_BASE_URL, DEV_CLERK_USER_ID, USE_BACKEND_GENERATION } from '../config/env';

interface BackendGenerateRequest {
  request: GenerationRequest;
  preferences: UserPreferences;
  count: number;
  swapInstruction?: string;
  baseRecipe?: Recipe;
}

interface BackendSummaryRequest {
  request: GenerationRequest;
  preferences: UserPreferences;
  count: number;
}

interface BackendHydrateRequest {
  request: GenerationRequest;
  preferences: UserPreferences;
  summary: RecipeSummary;
  swapInstruction?: string;
  baseRecipe?: Recipe;
}

function ensureConfigured() {
  if (!USE_BACKEND_GENERATION) {
    throw new Error('Backend integration is disabled.');
  }
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }
}

async function backendFetch<T>(
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    idempotencyKey?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  ensureConfigured();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-dev-clerk-user-id': DEV_CLERK_USER_ID,
  };
  if (init.idempotencyKey) {
    headers['Idempotency-Key'] = init.idempotencyKey;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export function isBackendEnabled() {
  return USE_BACKEND_GENERATION && Boolean(API_BASE_URL);
}

export async function generateRecipesViaBackend(
  payload: BackendGenerateRequest,
  options?: { signal?: AbortSignal },
): Promise<Recipe[]> {
  const idempotencyKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const data = await backendFetch<{ recipes: Recipe[] }>('/v1/recipes/generate', {
    method: 'POST',
    body: payload,
    idempotencyKey,
    signal: options?.signal,
  });
  return data.recipes;
}

export async function generateRecipeSummariesViaBackend(
  payload: BackendSummaryRequest,
  options?: { signal?: AbortSignal },
): Promise<RecipeSummary[]> {
  const idempotencyKey = `${Date.now()}-${Math.random().toString(16).slice(2)}-summary`;
  const data = await backendFetch<{ recipes: RecipeSummary[] }>('/v1/recipes/generate-summaries', {
    method: 'POST',
    body: payload,
    idempotencyKey,
    signal: options?.signal,
  });
  return data.recipes;
}

export async function hydrateRecipeViaBackend(
  payload: BackendHydrateRequest,
  options?: { signal?: AbortSignal },
): Promise<Recipe> {
  const data = await backendFetch<{ recipe: Recipe }>('/v1/recipes/hydrate-recipe', {
    method: 'POST',
    body: payload,
    signal: options?.signal,
  });
  return data.recipe;
}

export async function askAgentViaBackend(question: string, recipes: Recipe[]): Promise<string> {
  const data = await backendFetch<{ answer: string }>('/v1/recipes/agent', {
    method: 'POST',
    body: { question, recipes },
  });
  return data.answer;
}

export async function getCookbookViaBackend(): Promise<StoredRecipe[]> {
  const data = await backendFetch<{ recipes: StoredRecipe[] }>('/v1/cookbook');
  return data.recipes;
}

export async function getRecipeViaBackend(recipeId: string): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}`);
  return data.recipe;
}

export interface CreateRecipePayload {
  title: string;
  cuisine: string;
  servings: number;
  total_time_minutes: number;
  difficulty: string;
  short_hook: string;
  dietary_tags: string[];
  allergen_warnings: string[];
  video_url?: string | null;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  change_note?: string | null;
  source_type: 'generated' | 'link' | 'pdf' | 'text';
  source_url?: string | null;
}

export async function createRecipeViaBackend(payload: CreateRecipePayload): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>('/v1/recipes', { method: 'POST', body: payload });
  return data.recipe;
}

export async function importRecipeFromUrlViaBackend(url: string): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>('/v1/recipes/import-url', {
    method: 'POST',
    body: { url },
  });
  return data.recipe;
}

export async function addRecipeVersionViaBackend(
  recipeId: string,
  payload: { ingredients: Ingredient[]; steps: RecipeStep[]; change_note?: string | null; set_as_current: boolean },
): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}/versions`, {
    method: 'POST',
    body: payload,
  });
  return data.recipe;
}

export async function setCurrentVersionViaBackend(recipeId: string, versionId: string): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}/current-version`, {
    method: 'PATCH',
    body: { version_id: versionId },
  });
  return data.recipe;
}

export async function deleteRecipeVersionViaBackend(
  recipeId: string,
  versionId: string,
): Promise<{ deletedRecipe: boolean; recipe: StoredRecipe | null }> {
  return backendFetch(`/v1/recipes/${recipeId}/versions/${versionId}`, { method: 'DELETE' });
}

export async function deleteRecipeViaBackend(recipeId: string): Promise<void> {
  await backendFetch(`/v1/recipes/${recipeId}`, { method: 'DELETE' });
}

export async function setVideoLinkViaBackend(recipeId: string, videoUrl: string | null): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}/video-link`, {
    method: 'PUT',
    body: { video_url: videoUrl },
  });
  return data.recipe;
}

export async function setFavoriteViaBackend(recipeId: string, isFavorite: boolean): Promise<void> {
  await backendFetch(`/v1/cookbook/items/${recipeId}/favorite`, { method: 'PUT', body: { is_favorite: isFavorite } });
}

export async function removeRecipeViaBackend(recipeId: string): Promise<void> {
  await backendFetch<{ ok: boolean }>(`/v1/cookbook/items/${recipeId}`, {
    method: 'DELETE',
  });
}

export async function reorderCookbookViaBackend(recipeIds: string[]): Promise<void> {
  await backendFetch<{ ok: boolean }>('/v1/cookbook/items/reorder', {
    method: 'PATCH',
    body: { recipeIds },
  });
}

export async function getPreferencesViaBackend(): Promise<{ preferences: UserPreferencesV2; plan: string }> {
  return backendFetch('/v1/preferences');
}

export async function updatePreferencesViaBackend(
  update: Partial<UserPreferencesV2>,
): Promise<{ preferences: UserPreferencesV2 }> {
  return backendFetch('/v1/preferences', { method: 'PATCH', body: update });
}
