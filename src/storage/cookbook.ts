import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Recipe } from '../types';
import {
  getCookbookViaBackend,
  isBackendEnabled,
  removeRecipeViaBackend,
  reorderCookbookViaBackend,
  saveRecipeViaBackend,
} from '../api/backend';

const COOKBOOK_KEY = 'meno:cookbook';
const COOKBOOK_OUTBOX_KEY = 'meno:cookbook_outbox';
const COOKBOOK_SYNC_ERROR_KEY = 'meno:cookbook_sync_error';

type OutboxOp =
  | { id: string; type: 'save'; recipe: Recipe; attempts: number; nextAttemptAt: number }
  | { id: string; type: 'remove'; recipeId: string; attempts: number; nextAttemptAt: number }
  | { id: string; type: 'reorder'; recipeIds: string[]; attempts: number; nextAttemptAt: number };
type OutboxEnqueueOp =
  | { type: 'save'; recipe: Recipe }
  | { type: 'remove'; recipeId: string }
  | { type: 'reorder'; recipeIds: string[] };

let processingOutbox = false;

function opId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function readCookbookLocal(): Promise<Recipe[]> {
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

async function writeCookbookLocal(recipes: Recipe[]): Promise<void> {
  await AsyncStorage.setItem(COOKBOOK_KEY, JSON.stringify(recipes));
}

async function readOutbox(): Promise<OutboxOp[]> {
  const raw = await AsyncStorage.getItem(COOKBOOK_OUTBOX_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as OutboxOp[];
  } catch {
    return [];
  }
}

async function writeOutbox(items: OutboxOp[]): Promise<void> {
  await AsyncStorage.setItem(COOKBOOK_OUTBOX_KEY, JSON.stringify(items));
}

async function setSyncError(message: string | null): Promise<void> {
  if (!message) {
    await AsyncStorage.removeItem(COOKBOOK_SYNC_ERROR_KEY);
    return;
  }
  await AsyncStorage.setItem(COOKBOOK_SYNC_ERROR_KEY, message);
}

export async function getCookbookSyncError(): Promise<string | null> {
  return AsyncStorage.getItem(COOKBOOK_SYNC_ERROR_KEY);
}

async function enqueue(op: OutboxEnqueueOp): Promise<void> {
  const queue = await readOutbox();
  queue.push({ ...op, id: opId(), attempts: 0, nextAttemptAt: Date.now() });
  await writeOutbox(queue);
}

function nextBackoffMs(attempt: number): number {
  return Math.min(60_000, 2_000 * 2 ** attempt);
}

export async function flushCookbookOutbox(): Promise<boolean> {
  if (!isBackendEnabled()) {
    return true;
  }
  if (processingOutbox) {
    return false;
  }

  processingOutbox = true;
  try {
    const queue = await readOutbox();
    let changed = false;

    for (let i = 0; i < queue.length; i += 1) {
      const op = queue[i]!;
      if (op.nextAttemptAt > Date.now()) {
        continue;
      }
      try {
        if (op.type === 'save') {
          await saveRecipeViaBackend(op.recipe);
        } else if (op.type === 'remove') {
          if (isUuid(op.recipeId)) {
            await removeRecipeViaBackend(op.recipeId);
          }
        } else if (op.type === 'reorder') {
          const onlyUuids = op.recipeIds.filter(isUuid);
          if (onlyUuids.length > 0) {
            await reorderCookbookViaBackend(onlyUuids);
          }
        }

        queue.splice(i, 1);
        i -= 1;
        changed = true;
      } catch {
        queue[i] = {
          ...op,
          attempts: op.attempts + 1,
          nextAttemptAt: Date.now() + nextBackoffMs(op.attempts),
        } as OutboxOp;
        changed = true;
        await setSyncError('Could not sync changes. Tap to retry.');
        break;
      }
    }

    if (changed) {
      await writeOutbox(queue);
    }

    if (queue.length === 0) {
      await setSyncError(null);
    }

    return queue.length === 0;
  } finally {
    processingOutbox = false;
  }
}

export async function retryCookbookSync(): Promise<boolean> {
  const drained = await flushCookbookOutbox();
  if (drained) {
    await setSyncError(null);
  }
  return drained;
}

function withRecipeMetadata(recipe: Recipe): Recipe {
  return {
    ...recipe,
    recipe_family_id: recipe.recipe_family_id ?? recipe.id,
    version_number: recipe.version_number ?? 1,
    created_at: recipe.created_at ?? Date.now(),
  };
}

export async function getCookbook(): Promise<Recipe[]> {
  const local = await readCookbookLocal();
  if (!isBackendEnabled()) {
    return local;
  }

  const drained = await flushCookbookOutbox();
  if (!drained) {
    return local;
  }

  try {
    const remote = await getCookbookViaBackend();
    await writeCookbookLocal(remote);
    return remote;
  } catch {
    return local;
  }
}

export async function setCookbookOrder(recipes: Recipe[]): Promise<void> {
  await writeCookbookLocal(recipes);
  if (!isBackendEnabled()) {
    return;
  }

  await enqueue({ type: 'reorder', recipeIds: recipes.map((recipe) => recipe.id) });
  void flushCookbookOutbox();
}

export async function saveRecipeToCookbook(recipe: Recipe): Promise<boolean> {
  const local = await readCookbookLocal();
  const normalized = withRecipeMetadata(recipe);
  const alreadySaved = local.some((r) => r.id === normalized.id);

  if (!alreadySaved) {
    const deduped = [normalized, ...local.filter((r) => r.id !== normalized.id)];
    await writeCookbookLocal(deduped);
  }

  if (!isBackendEnabled()) {
    return !alreadySaved;
  }

  if (!alreadySaved) {
    await enqueue({ type: 'save', recipe: normalized });
    void flushCookbookOutbox();
  }

  return !alreadySaved;
}

interface SaveRecipeRevisionParams {
  baseRecipeId: string;
  revisedRecipe: Recipe;
  replaceBase?: boolean;
  changeNote?: string;
}

export async function saveRecipeRevision(params: SaveRecipeRevisionParams): Promise<Recipe> {
  const { baseRecipeId, revisedRecipe, replaceBase, changeNote } = params;
  const existing = await readCookbookLocal();
  const base = existing.find((item) => item.id === baseRecipeId);

  if (!base) {
    const fallback = withRecipeMetadata({
      ...revisedRecipe,
      change_note: changeNote ?? revisedRecipe.change_note,
    });
    await writeCookbookLocal([fallback, ...existing.filter((item) => item.id !== fallback.id)]);
    if (isBackendEnabled()) {
      await enqueue({ type: 'save', recipe: fallback });
      void flushCookbookOutbox();
    }
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

  await writeCookbookLocal(nextList);

  if (isBackendEnabled()) {
    await enqueue({ type: 'save', recipe: normalized });
    if (replaceBase) {
      await enqueue({ type: 'remove', recipeId: base.id });
    }
    void flushCookbookOutbox();
  }

  return normalized;
}

export async function removeRecipeFromCookbook(id: string): Promise<void> {
  const local = await readCookbookLocal();
  await writeCookbookLocal(local.filter((recipe) => recipe.id !== id));

  if (!isBackendEnabled()) {
    return;
  }

  await enqueue({ type: 'remove', recipeId: id });
  void flushCookbookOutbox();
}

export async function removeRecipesFromCookbook(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  const local = await readCookbookLocal();
  await writeCookbookLocal(local.filter((recipe) => !idSet.has(recipe.id)));

  if (!isBackendEnabled()) {
    return;
  }

  for (const id of ids) {
    await enqueue({ type: 'remove', recipeId: id });
  }
  void flushCookbookOutbox();
}

export async function moveRecipesToTop(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  const existing = await readCookbookLocal();
  const selected = existing.filter((recipe) => idSet.has(recipe.id));
  const rest = existing.filter((recipe) => !idSet.has(recipe.id));
  const ordered = [...selected, ...rest];

  await setCookbookOrder(ordered);
}

export async function clearCookbook(): Promise<void> {
  const local = await readCookbookLocal();
  await AsyncStorage.removeItem(COOKBOOK_KEY);

  if (!isBackendEnabled()) {
    return;
  }

  for (const recipe of local) {
    await enqueue({ type: 'remove', recipeId: recipe.id });
  }
  void flushCookbookOutbox();
}
