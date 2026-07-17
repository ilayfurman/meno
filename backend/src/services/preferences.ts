import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userPreferences, users } from '../db/schema.js';

export interface PreferencesUpdate {
  diet?: string | null;
  avoid?: string[];
  notify_recipe_saved?: boolean;
  notify_weekly_digest?: boolean;
  notify_product_updates?: boolean;
}

function rowToApi(row: typeof userPreferences.$inferSelect) {
  return {
    diet: row.diet,
    avoid: row.avoid as string[],
    notify_recipe_saved: row.notifyRecipeSaved,
    notify_weekly_digest: row.notifyWeeklyDigest,
    notify_product_updates: row.notifyProductUpdates,
  };
}

export async function getPreferences(userId: string) {
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (row) {
    return rowToApi(row);
  }
  const [created] = await db.insert(userPreferences).values({ userId }).returning();
  return rowToApi(created!);
}

export async function updatePreferences(userId: string, update: PreferencesUpdate) {
  await db
    .insert(userPreferences)
    .values({
      userId,
      diet: update.diet,
      avoid: update.avoid ?? [],
      notifyRecipeSaved: update.notify_recipe_saved ?? true,
      notifyWeeklyDigest: update.notify_weekly_digest ?? false,
      notifyProductUpdates: update.notify_product_updates ?? false,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        ...(update.diet !== undefined ? { diet: update.diet } : {}),
        ...(update.avoid !== undefined ? { avoid: update.avoid } : {}),
        ...(update.notify_recipe_saved !== undefined ? { notifyRecipeSaved: update.notify_recipe_saved } : {}),
        ...(update.notify_weekly_digest !== undefined ? { notifyWeeklyDigest: update.notify_weekly_digest } : {}),
        ...(update.notify_product_updates !== undefined
          ? { notifyProductUpdates: update.notify_product_updates }
          : {}),
      },
    });
  return getPreferences(userId);
}

export async function getPlan(userId: string): Promise<string> {
  const [row] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.plan ?? 'free';
}
