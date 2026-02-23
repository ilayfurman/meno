import type { GenerationRequest, Recipe, RecipeSummary, UserPreferences } from '../types';
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
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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

export async function getCookbookViaBackend(): Promise<Recipe[]> {
  const data = await backendFetch<{ recipes: Recipe[] }>('/v1/cookbook');
  return data.recipes;
}

export async function saveRecipeViaBackend(recipe: Recipe): Promise<boolean> {
  const data = await backendFetch<{ saved: boolean }>('/v1/cookbook/items', {
    method: 'POST',
    body: { recipe },
  });
  return data.saved;
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
