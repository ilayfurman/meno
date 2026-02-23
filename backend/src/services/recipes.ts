import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { cookbookItems, recipes } from '../db/schema.js';
import type { Recipe } from '../types/recipe.js';

type RecipeRow = typeof recipes.$inferSelect;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    cuisine: row.cuisine,
    servings: row.servings,
    total_time_minutes: row.totalTimeMinutes,
    difficulty: row.difficulty,
    short_hook: row.shortHook,
    ingredients: row.ingredients as Recipe['ingredients'],
    steps: row.steps as Recipe['steps'],
    substitutions: row.substitutions as Recipe['substitutions'],
    dietary_tags: row.dietaryTags as string[],
    allergen_warnings: row.allergenWarnings as string[],
    completion_state: 'full',
  };
}

export async function createRecipeForUser(
  userId: string | null,
  recipe: (Omit<Recipe, 'id'> & { id?: string }) & {
    sourceType?: string;
    sourceUrl?: string | null;
    sourceDomain?: string | null;
  },
) {
  const inserted = await db
    .insert(recipes)
    .values({
      id: recipe.id && uuidPattern.test(recipe.id) ? recipe.id : undefined,
      ownerUserId: userId,
      title: recipe.title,
      cuisine: recipe.cuisine,
      servings: recipe.servings,
      totalTimeMinutes: recipe.total_time_minutes,
      difficulty: recipe.difficulty,
      shortHook: recipe.short_hook,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      substitutions: recipe.substitutions,
      dietaryTags: recipe.dietary_tags,
      allergenWarnings: recipe.allergen_warnings,
      sourceType: recipe.sourceType ?? 'generated',
      sourceUrl: recipe.sourceUrl ?? null,
      sourceDomain: recipe.sourceDomain ?? null,
    })
    .returning();

  return rowToRecipe(inserted[0]!);
}

export async function getRecipeByIdForUser(recipeId: string, userId: string) {
  const found = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), or(isNull(recipes.ownerUserId), eq(recipes.ownerUserId, userId))))
    .limit(1);

  return found[0] ? rowToRecipe(found[0]) : null;
}

export async function ensureRecipeAndSaveToCookbook(userId: string, recipe: Recipe): Promise<boolean> {
  let recipeId = recipe.id;

  const existing = uuidPattern.test(recipeId)
    ? await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, recipeId)).limit(1)
    : [];
  if (!existing[0]) {
    const created = await createRecipeForUser(userId, recipe);
    recipeId = created.id;
  }

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

  await db.insert(cookbookItems).values({
    userId,
    recipeId,
    orderIndex: nextOrder,
  });

  return true;
}

export async function listCookbook(userId: string): Promise<Recipe[]> {
  const rows = await db
    .select({
      recipe: recipes,
      orderIndex: cookbookItems.orderIndex,
    })
    .from(cookbookItems)
    .innerJoin(recipes, eq(cookbookItems.recipeId, recipes.id))
    .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.isArchived, false)))
    .orderBy(asc(cookbookItems.orderIndex));

  return rows.map((row) => rowToRecipe(row.recipe));
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
