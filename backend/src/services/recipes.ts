import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { cookbookItems, recipeVersions, recipes } from '../db/schema.js';
import type { RecipeVersion, StoredRecipe } from '../types/recipe.js';
import { detectVideoPlatform } from '../utils/videoPlatform.js';

type RecipeRow = typeof recipes.$inferSelect;
type VersionRow = typeof recipeVersions.$inferSelect;

function rowToVersion(row: VersionRow): RecipeVersion {
  return {
    id: row.id,
    version_number: row.versionNumber,
    ingredients: row.ingredients as RecipeVersion['ingredients'],
    steps: row.steps as RecipeVersion['steps'],
    change_note: row.changeNote,
    created_at: row.createdAt.toISOString(),
  };
}

async function assembleStoredRecipe(recipeRow: RecipeRow, isFavorite: boolean): Promise<StoredRecipe> {
  const versionRows = await db
    .select()
    .from(recipeVersions)
    .where(eq(recipeVersions.recipeId, recipeRow.id))
    .orderBy(asc(recipeVersions.versionNumber));

  const versions = versionRows.map(rowToVersion);
  const current = versions.find((v) => v.id === recipeRow.currentVersionId) ?? versions[versions.length - 1];

  if (!current) {
    throw new Error(`Recipe ${recipeRow.id} has no versions`);
  }

  return {
    id: recipeRow.id,
    title: recipeRow.title,
    cuisine: recipeRow.cuisine,
    servings: recipeRow.servings,
    total_time_minutes: recipeRow.totalTimeMinutes,
    difficulty: recipeRow.difficulty,
    short_hook: recipeRow.shortHook,
    dietary_tags: recipeRow.dietaryTags as string[],
    allergen_warnings: recipeRow.allergenWarnings as string[],
    video_url: recipeRow.videoUrl,
    video_platform: recipeRow.videoPlatform as StoredRecipe['video_platform'],
    is_favorite: isFavorite,
    current_version: current,
    versions,
  };
}

async function getFavoriteFlag(userId: string, recipeId: string): Promise<boolean> {
  const favRow = await db
    .select({ isFavorite: cookbookItems.isFavorite })
    .from(cookbookItems)
    .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeId)))
    .limit(1);
  return favRow[0]?.isFavorite ?? false;
}

export interface CreateRecipeInput {
  title: string;
  cuisine: string;
  servings: number;
  total_time_minutes: number;
  difficulty: string;
  short_hook: string;
  dietary_tags: string[];
  allergen_warnings: string[];
  video_url?: string | null;
  ingredients: unknown;
  steps: unknown;
  change_note?: string | null;
  source_type?: string;
  source_url?: string | null;
}

export async function createRecipeForUser(userId: string, input: CreateRecipeInput): Promise<StoredRecipe> {
  return db.transaction(async (tx) => {
    const [recipeRow] = await tx
      .insert(recipes)
      .values({
        ownerUserId: userId,
        title: input.title,
        cuisine: input.cuisine,
        servings: input.servings,
        totalTimeMinutes: input.total_time_minutes,
        difficulty: input.difficulty,
        shortHook: input.short_hook,
        dietaryTags: input.dietary_tags,
        allergenWarnings: input.allergen_warnings,
        videoUrl: input.video_url ?? null,
        videoPlatform: detectVideoPlatform(input.video_url ?? null),
        sourceType: input.source_type ?? 'generated',
        sourceUrl: input.source_url ?? null,
      })
      .returning();

    const [versionRow] = await tx
      .insert(recipeVersions)
      .values({
        recipeId: recipeRow!.id,
        versionNumber: 1,
        ingredients: input.ingredients,
        steps: input.steps,
        changeNote: input.change_note ?? null,
      })
      .returning();

    await tx.update(recipes).set({ currentVersionId: versionRow!.id }).where(eq(recipes.id, recipeRow!.id));

    return assembleStoredRecipe({ ...recipeRow!, currentVersionId: versionRow!.id }, false);
  });
}

export interface AddVersionInput {
  ingredients: unknown;
  steps: unknown;
  change_note?: string | null;
  set_as_current: boolean;
}

export async function addRecipeVersion(
  recipeId: string,
  userId: string,
  input: AddVersionInput,
): Promise<StoredRecipe | null> {
  const recipeRow = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), or(isNull(recipes.ownerUserId), eq(recipes.ownerUserId, userId))))
      .limit(1);
    if (!existing) {
      return null;
    }

    const [maxRow] = await tx
      .select({ maxVersion: sql<number>`coalesce(max(${recipeVersions.versionNumber}), 0)` })
      .from(recipeVersions)
      .where(eq(recipeVersions.recipeId, recipeId));
    const nextVersion = (maxRow?.maxVersion ?? 0) + 1;

    const [versionRow] = await tx
      .insert(recipeVersions)
      .values({
        recipeId,
        versionNumber: nextVersion,
        ingredients: input.ingredients,
        steps: input.steps,
        changeNote: input.change_note ?? null,
      })
      .returning();

    if (input.set_as_current) {
      await tx
        .update(recipes)
        .set({ currentVersionId: versionRow!.id, updatedAt: new Date() })
        .where(eq(recipes.id, recipeId));
    }

    const [refreshed] = await tx.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
    return refreshed ?? null;
  });

  if (!recipeRow) {
    return null;
  }
  return assembleStoredRecipe(recipeRow, await getFavoriteFlag(userId, recipeId));
}

export async function setCurrentVersion(
  recipeId: string,
  userId: string,
  versionId: string,
): Promise<StoredRecipe | null> {
  const recipeRow = await db.transaction(async (tx) => {
    const [version] = await tx
      .select()
      .from(recipeVersions)
      .where(and(eq(recipeVersions.id, versionId), eq(recipeVersions.recipeId, recipeId)))
      .limit(1);
    if (!version) {
      return null;
    }

    await tx.update(recipes).set({ currentVersionId: versionId, updatedAt: new Date() }).where(eq(recipes.id, recipeId));

    const [refreshed] = await tx.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
    return refreshed ?? null;
  });

  if (!recipeRow) {
    return null;
  }
  return assembleStoredRecipe(recipeRow, await getFavoriteFlag(userId, recipeId));
}

/**
 * Deletes one version. If it was the recipe's current version, falls back to the
 * next-most-recent remaining version. If it was the last remaining version, the
 * whole recipe is deleted (a recipe must always have >=1 version).
 */
export async function deleteRecipeVersion(
  recipeId: string,
  userId: string,
  versionId: string,
): Promise<{ deletedRecipe: boolean; recipe: StoredRecipe | null }> {
  const result = await db.transaction(async (tx) => {
    const [recipeRow] = await tx
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), or(isNull(recipes.ownerUserId), eq(recipes.ownerUserId, userId))))
      .limit(1);
    if (!recipeRow) {
      return { found: false as const, deletedRecipe: false, recipeRow: null };
    }

    const remaining = await tx
      .select()
      .from(recipeVersions)
      .where(eq(recipeVersions.recipeId, recipeId))
      .orderBy(asc(recipeVersions.versionNumber));

    const isLastVersion = remaining.length <= 1;
    if (isLastVersion) {
      await tx.delete(recipes).where(eq(recipes.id, recipeId));
      return { found: true as const, deletedRecipe: true, recipeRow: null };
    }

    await tx.delete(recipeVersions).where(eq(recipeVersions.id, versionId));

    let currentVersionId = recipeRow.currentVersionId;
    if (currentVersionId === versionId) {
      const fallback = remaining.filter((v) => v.id !== versionId).slice(-1)[0];
      currentVersionId = fallback ? fallback.id : null;
    }
    await tx.update(recipes).set({ currentVersionId, updatedAt: new Date() }).where(eq(recipes.id, recipeId));

    const [refreshed] = await tx.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
    return { found: true as const, deletedRecipe: false, recipeRow: refreshed ?? null };
  });

  if (!result.found) {
    return { deletedRecipe: false, recipe: null };
  }
  if (result.deletedRecipe || !result.recipeRow) {
    return { deletedRecipe: true, recipe: null };
  }
  return { deletedRecipe: false, recipe: await assembleStoredRecipe(result.recipeRow, await getFavoriteFlag(userId, recipeId)) };
}

/** Deletes the whole recipe family (all versions) in one step. */
export async function deleteRecipe(recipeId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(recipes)
    .where(and(eq(recipes.id, recipeId), or(isNull(recipes.ownerUserId), eq(recipes.ownerUserId, userId))))
    .returning({ id: recipes.id });
  return result.length > 0;
}

export async function getRecipeByIdForUser(recipeId: string, userId: string): Promise<StoredRecipe | null> {
  const [recipeRow] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), or(isNull(recipes.ownerUserId), eq(recipes.ownerUserId, userId))))
    .limit(1);
  if (!recipeRow) {
    return null;
  }
  return assembleStoredRecipe(recipeRow, await getFavoriteFlag(userId, recipeId));
}

export async function saveRecipeToCookbook(userId: string, recipeId: string): Promise<boolean> {
  const dup = await db
    .select({ id: cookbookItems.id })
    .from(cookbookItems)
    .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeId)))
    .limit(1);
  if (dup[0]) {
    return false;
  }

  const top = await db
    .select({ minOrder: sql<number>`coalesce(min(${cookbookItems.orderIndex}), 0)` })
    .from(cookbookItems)
    .where(eq(cookbookItems.userId, userId));
  const nextOrder = (top[0]?.minOrder ?? 0) - 1;

  await db.insert(cookbookItems).values({ userId, recipeId, orderIndex: nextOrder });
  return true;
}

export async function listCookbook(userId: string): Promise<StoredRecipe[]> {
  const rows = await db
    .select({ recipe: recipes, isFavorite: cookbookItems.isFavorite, orderIndex: cookbookItems.orderIndex })
    .from(cookbookItems)
    .innerJoin(recipes, eq(cookbookItems.recipeId, recipes.id))
    .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.isArchived, false)))
    .orderBy(asc(cookbookItems.orderIndex));

  return Promise.all(rows.map((row) => assembleStoredRecipe(row.recipe, row.isFavorite)));
}

export async function setFavorite(userId: string, recipeId: string, isFavorite: boolean): Promise<void> {
  await db
    .update(cookbookItems)
    .set({ isFavorite })
    .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeId)));
}

export async function setVideoLink(
  recipeId: string,
  userId: string,
  videoUrl: string | null,
): Promise<StoredRecipe | null> {
  const [updated] = await db
    .update(recipes)
    .set({ videoUrl, videoPlatform: detectVideoPlatform(videoUrl), updatedAt: new Date() })
    .where(and(eq(recipes.id, recipeId), or(isNull(recipes.ownerUserId), eq(recipes.ownerUserId, userId))))
    .returning();
  if (!updated) return null;
  return assembleStoredRecipe(updated, await getFavoriteFlag(userId, recipeId));
}

export async function removeFromCookbook(userId: string, recipeId: string) {
  await db.delete(cookbookItems).where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeId)));
}

export async function reorderCookbook(userId: string, recipeIds: string[]) {
  if (recipeIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (let idx = 0; idx < recipeIds.length; idx += 1) {
      await tx
        .update(cookbookItems)
        .set({ orderIndex: idx })
        .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeIds[idx]!)));
    }
  });
}
