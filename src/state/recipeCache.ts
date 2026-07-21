import { getRecipeViaBackend } from '../api/backend';
import type { StoredRecipe } from '../types';

// Simple in-memory cache, alive for the app session only (cleared on
// restart, never persisted to disk). Lets Recipe Detail render instantly
// from a previous fetch -- either an earlier visit this session, or the
// Cookbook screen's background prefetch below -- instead of always
// blocking on a fresh network round trip. Every place RecipeDetailScreen
// updates its own local `recipe` state after a mutation (favorite, photo,
// links, versions...) writes through to this cache too, so it can't go
// stale within a session.
const cache = new Map<string, StoredRecipe>();

// Tracks fetches already in flight so a background prefetch and a real
// navigation to the same recipe (e.g. tapping a card right after the
// Cookbook page loads) don't both fire their own network request.
const inFlight = new Map<string, Promise<StoredRecipe>>();

export function getCachedRecipe(id: string): StoredRecipe | undefined {
  return cache.get(id);
}

export function setCachedRecipe(recipe: StoredRecipe): void {
  cache.set(recipe.id, recipe);
}

export function removeCachedRecipe(id: string): void {
  cache.delete(id);
}

// Fetches and caches a recipe if it isn't already cached or being fetched.
// Fire-and-forget by design -- the Cookbook screen's background prefetch
// doesn't need the result, it just wants the cache warm by the time the
// user actually taps a card. Bounded to whatever page of recipes the
// caller passes in (see CookbookScreen) rather than the user's whole
// cookbook, so the number of background requests stays constant no matter
// how large the cookbook grows.
export function prefetchRecipe(id: string): void {
  if (cache.has(id) || inFlight.has(id)) return;
  const promise = getRecipeViaBackend(id)
    .then((recipe) => {
      cache.set(id, recipe);
      return recipe;
    })
    .finally(() => inFlight.delete(id));
  inFlight.set(id, promise);
  // Swallow failures here -- a failed prefetch just means the detail
  // screen falls back to its normal fetch-on-open path, same as if this
  // never ran. Surfacing the error twice (once here, once when the user
  // actually opens it) would be noisy for no benefit.
  promise.catch(() => {});
}
