import type {
  CookbookListItem,
  GenerationRequest,
  Ingredient,
  Recipe,
  RecipeStep,
  RecipeSummary,
  StoredRecipe,
  UserPreferences,
  UserPreferencesV2,
} from '../types';
import { API_BASE_URL, CLERK_PUBLISHABLE_KEY, DEV_CLERK_USER_ID, USE_BACKEND_GENERATION } from '../config/env';

// Resolves the auth header for every backend request. When Clerk is
// configured and a session is active, this sends a real Bearer token —
// getClerkInstance() works outside of React components/hooks by design, so
// this plain async function doesn't need to be a hook.
//
// IMPORTANT: once Clerk is configured, this must NEVER silently fall back to
// the dev header. The backend maps that fixed dev identity to its own
// separate internal user record -- if even one request went out under it
// (e.g. a brief timing hiccup on cold start, before Clerk's session object
// finishes hydrating), anything read or written through it would silently
// live under a different "user" than your real Clerk account, with no
// error. That's exactly what caused saved recipes to appear to vanish after
// a sign-out/sign-in. So: retry briefly for a real session, and if Clerk is
// configured but still has none, throw a visible error instead of silently
// switching identities. The dev header now only exists for the
// Clerk-not-configured-at-all case (local dev before a Clerk app exists).
async function getAuthHeaders(): Promise<Record<string, string>> {
  if (CLERK_PUBLISHABLE_KEY) {
    // Imported lazily so this module doesn't hard-require @clerk/expo to
    // have a provider mounted when Clerk isn't configured at all.
    const { getClerkInstance } = await import('@clerk/expo');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const clerk = getClerkInstance();
        const token = await clerk.session?.getToken();
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
      } catch {
        // keep retrying — session may still be hydrating
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error('No active Clerk session available yet. Please try again in a moment.');
  }
  return { 'x-dev-clerk-user-id': DEV_CLERK_USER_ID };
}

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
  const isFormData = init.body instanceof FormData;
  const headers: Record<string, string> = await getAuthHeaders();
  // Only set this when there's an actual body to send -- Fastify's default
  // JSON body parser throws a 400 (FST_ERR_CTP_EMPTY_JSON_BODY) when it sees
  // `Content-Type: application/json` on a request with no body, which is
  // exactly what a body-less DELETE (or any other verb with no payload)
  // sends. Every mutation before delete-version/delete-recipe always carried
  // a real JSON body, so this never surfaced until now.
  if (!isFormData && init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (init.idempotencyKey) {
    headers['Idempotency-Key'] = init.idempotencyKey;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: isFormData ? (init.body as FormData) : init.body ? JSON.stringify(init.body) : undefined,
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

export interface CookbookPage {
  recipes: CookbookListItem[];
  hasMore: boolean;
}

export interface CookbookQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  filter?: string;
  sort?: 'recent' | 'title_asc' | 'time_asc' | 'time_desc';
}

export async function getCookbookViaBackend(params: CookbookQueryParams = {}): Promise<CookbookPage> {
  // Built by hand rather than via URLSearchParams -- that's not guaranteed
  // to be polyfilled in the Hermes/RN runtime this app runs on, and nothing
  // else in this file relies on it either.
  const parts = [`limit=${params.limit ?? 24}`, `offset=${params.offset ?? 0}`];
  if (params.search) parts.push(`search=${encodeURIComponent(params.search)}`);
  if (params.filter) parts.push(`filter=${encodeURIComponent(params.filter)}`);
  if (params.sort) parts.push(`sort=${encodeURIComponent(params.sort)}`);

  const data = await backendFetch<{ recipes: CookbookListItem[]; has_more: boolean }>(
    `/v1/cookbook?${parts.join('&')}`,
  );
  return { recipes: data.recipes, hasMore: data.has_more };
}

export async function getCookbookStatsViaBackend(): Promise<{ total: number; favorites: number }> {
  return backendFetch('/v1/cookbook/stats');
}

export async function getCookbookCuisinesViaBackend(): Promise<string[]> {
  const data = await backendFetch<{ cuisines: string[] }>('/v1/cookbook/cuisines');
  return data.cuisines;
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

export interface DuplicateCandidate {
  id: string;
  title: string;
  cuisine: string;
  total_time_minutes: number;
}

// Import routes return either a freshly-created recipe, or -- when a likely
// duplicate is already in the user's cookbook -- the existing match plus the
// newly-extracted `candidate` payload, so the caller can let the user decide
// (view the existing one, or add this anyway via createRecipeViaBackend
// without paying for AI extraction a second time).
export type ImportOutcome =
  | { kind: 'created'; recipe: StoredRecipe }
  | { kind: 'duplicate'; existing: DuplicateCandidate; candidate: CreateRecipePayload };

function toImportOutcome(data: { recipe?: StoredRecipe; duplicate?: DuplicateCandidate; candidate?: CreateRecipePayload }): ImportOutcome {
  if (data.recipe) {
    return { kind: 'created', recipe: data.recipe };
  }
  return { kind: 'duplicate', existing: data.duplicate!, candidate: data.candidate! };
}

export async function importRecipeFromUrlViaBackend(url: string, force = false): Promise<ImportOutcome> {
  const data = await backendFetch<{ recipe?: StoredRecipe; duplicate?: DuplicateCandidate; candidate?: CreateRecipePayload }>(
    '/v1/recipes/import-url',
    { method: 'POST', body: { url, force } },
  );
  return toImportOutcome(data);
}

export async function importRecipeFromTextViaBackend(text: string, force = false): Promise<ImportOutcome> {
  const data = await backendFetch<{ recipe?: StoredRecipe; duplicate?: DuplicateCandidate; candidate?: CreateRecipePayload }>(
    '/v1/recipes/import-text',
    { method: 'POST', body: { text, force } },
  );
  return toImportOutcome(data);
}

export async function importRecipeFromPdfViaBackend(
  file: { uri: string; name: string },
  force = false,
): Promise<ImportOutcome> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: 'application/pdf',
  } as unknown as Blob);
  form.append('force', force ? 'true' : 'false');
  const data = await backendFetch<{ recipe?: StoredRecipe; duplicate?: DuplicateCandidate; candidate?: CreateRecipePayload }>(
    '/v1/recipes/import-pdf',
    { method: 'POST', body: form },
  );
  return toImportOutcome(data);
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

export async function updateRecipeVersionViaBackend(
  recipeId: string,
  versionId: string,
  payload: { ingredients: Ingredient[]; steps: RecipeStep[]; change_note?: string | null },
): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}/versions/${versionId}`, {
    method: 'PATCH',
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

export async function setRecipePhotoViaBackend(recipeId: string, imageUrl: string | null): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}/photo`, {
    method: 'PUT',
    body: { image_url: imageUrl },
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
