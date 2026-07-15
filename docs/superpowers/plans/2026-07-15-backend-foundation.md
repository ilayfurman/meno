# Backend Foundation (Versioning + Delete Semantics + Preferences) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Fastify + Drizzle + Postgres backend with linear per-recipe versioning, two-level delete (version vs. whole recipe), favoriting, video-link fields, and user preferences — per `docs/superpowers/specs/2026-07-15-cookbook-redesign-design.md`.

**Architecture:** Add a `recipe_versions` table holding the versioned content (ingredients/steps/change_note) that today lives flat on `recipes`; `recipes` becomes an identity row pointing at `current_version_id`. Extend `cookbook_items` with `is_favorite`. Add a new `user_preferences` table (1:1 with `users`). All new logic goes through `backend/src/services/recipes.ts`-style service functions, never inline in route handlers, so a future MCP tool handler can reuse them.

**Tech Stack:** Fastify 5, Drizzle ORM 0.44, Postgres (Neon), Zod, TypeScript (Node, ESM, `tsx`).

---

### Task 1: Schema — `recipe_versions` table and `recipes` identity split

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Add `recipeVersions` table and update `recipes`**

Replace the existing `recipes` table definition and add a new table above `cookbookItems`:

```typescript
export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    cuisine: text('cuisine').notNull(),
    servings: integer('servings').notNull(),
    totalTimeMinutes: integer('total_time_minutes').notNull(),
    difficulty: varchar('difficulty', { length: 32 }).notNull(),
    shortHook: text('short_hook').notNull(),
    dietaryTags: jsonb('dietary_tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    allergenWarnings: jsonb('allergen_warnings').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    currentVersionId: uuid('current_version_id'),
    videoUrl: text('video_url'),
    videoPlatform: varchar('video_platform', { length: 16 }),
    sourceType: varchar('source_type', { length: 32 }).notNull().default('generated'),
    sourceUrl: text('source_url'),
    sourceDomain: text('source_domain'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    totalTimeIdx: index('recipes_total_time_minutes_idx').on(table.totalTimeMinutes),
    difficultyIdx: index('recipes_difficulty_idx').on(table.difficulty),
    cuisineLowerIdx: index('recipes_cuisine_lower_idx').using('btree', sql`lower(${table.cuisine})`),
    dietaryTagsGinIdx: index('recipes_dietary_tags_gin_idx').using('gin', table.dietaryTags),
  }),
);

export const recipeVersions = pgTable(
  'recipe_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    ingredients: jsonb('ingredients').notNull(),
    steps: jsonb('steps').notNull(),
    changeNote: text('change_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recipeVersionUnique: unique('recipe_versions_recipe_version_unique').on(table.recipeId, table.versionNumber),
    recipeIdIdx: index('recipe_versions_recipe_id_idx').on(table.recipeId),
  }),
);
```

`substitutions` is dropped from `recipes` (not carried into `recipe_versions` — out of scope per spec, superseded by re-import/re-edit).

- [ ] **Step 2: Add `isFavorite` to `cookbookItems`**

In the existing `cookbookItems` table definition, add a field to the column object (after `isArchived`):

```typescript
    isFavorite: boolean('is_favorite').notNull().default(false),
```

- [ ] **Step 3: Add `userPreferences` table and `plan` on `users`**

Add to `users` table's column object (after `lastSeenAt`):

```typescript
    plan: varchar('plan', { length: 16 }).notNull().default('free'),
```

Add a new table after `users`:

```typescript
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  diet: varchar('diet', { length: 32 }),
  avoid: jsonb('avoid').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  notifyRecipeSaved: boolean('notify_recipe_saved').notNull().default(true),
  notifyWeeklyDigest: boolean('notify_weekly_digest').notNull().default(false),
  notifyProductUpdates: boolean('notify_product_updates').notNull().default(false),
});
```

- [ ] **Step 4: Generate and inspect the migration**

Run: `cd backend && npm run db:generate`
Expected: a new file under `backend/drizzle/` (e.g. `0001_*.sql`) is created. Open it and confirm it contains `CREATE TABLE "recipe_versions"`, `CREATE TABLE "user_preferences"`, `ALTER TABLE "recipes" ... DROP COLUMN "ingredients"`, `DROP COLUMN "steps"`, `DROP COLUMN "substitutions"`, `ADD COLUMN "current_version_id"`, `ADD COLUMN "video_url"`, `ADD COLUMN "video_platform"`, `ALTER TABLE "cookbook_items" ADD COLUMN "is_favorite"`, `ALTER TABLE "users" ADD COLUMN "plan"`. Do not run `db:migrate` yet (no dev database is configured in this environment) — the migration file existing and being well-formed is the validation for this task.

- [ ] **Step 5: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: fails at this point (service/route files still reference removed columns) — this is expected; proceed to Task 2 which fixes it. Note the failing file list for reference.

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle/
git commit -m "feat(backend): add recipe_versions, user_preferences, favorite/video fields"
```

---

### Task 2: Recipe types — versioned shape

**Files:**
- Modify: `backend/src/types/recipe.ts`

- [ ] **Step 1: Add version and recipe-with-versions schemas**

Add after `substitutionSchema` (keep `substitutionSchema` itself — still used by the OpenAI generation path in `services/openai.ts` for in-app Quick Generate output shape — but it's no longer stored on the DB row):

```typescript
export const recipeVersionSchema = z.object({
  id: z.string().uuid().optional(),
  version_number: z.number().int().min(1),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  change_note: z.string().nullable(),
  created_at: z.string().nullable().optional(),
});

export const storedRecipeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  cuisine: z.string(),
  servings: z.number().int().min(1),
  total_time_minutes: z.number().int().min(1),
  difficulty: z.string(),
  short_hook: z.string(),
  dietary_tags: z.array(z.string()),
  allergen_warnings: z.array(z.string()),
  video_url: z.string().url().nullable(),
  video_platform: z.enum(['tiktok', 'instagram', 'youtube', 'other']).nullable(),
  is_favorite: z.boolean(),
  current_version: recipeVersionSchema,
  versions: z.array(recipeVersionSchema),
});

export const createRecipeSchema = z.object({
  title: z.string().min(1),
  cuisine: z.string().min(1),
  servings: z.number().int().min(1),
  total_time_minutes: z.number().int().min(1),
  difficulty: z.string().min(1),
  short_hook: z.string().default(''),
  dietary_tags: z.array(z.string()).default([]),
  allergen_warnings: z.array(z.string()).default([]),
  video_url: z.string().url().nullable().optional(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  change_note: z.string().nullable().optional(),
  source_type: z.enum(['generated', 'link', 'pdf', 'text']).default('generated'),
  source_url: z.string().url().nullable().optional(),
});

export const addRecipeVersionSchema = z.object({
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  change_note: z.string().nullable().optional(),
  set_as_current: z.boolean().default(true),
});

export const updateVideoLinkSchema = z.object({
  video_url: z.string().url().nullable(),
});

export type StoredRecipe = z.infer<typeof storedRecipeSchema>;
export type RecipeVersion = z.infer<typeof recipeVersionSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/types/recipe.ts
git commit -m "feat(backend): add versioned recipe zod schemas"
```

---

### Task 3: Video platform detection utility

**Files:**
- Create: `backend/src/utils/videoPlatform.ts`
- Test: `backend/src/utils/videoPlatform.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectVideoPlatform } from './videoPlatform.js';

test('detects tiktok from hostname', () => {
  assert.equal(detectVideoPlatform('https://www.tiktok.com/@user/video/123'), 'tiktok');
});

test('detects instagram from hostname', () => {
  assert.equal(detectVideoPlatform('https://www.instagram.com/reel/abc'), 'instagram');
});

test('detects youtube from hostname including short domain', () => {
  assert.equal(detectVideoPlatform('https://youtu.be/abc123'), 'youtube');
  assert.equal(detectVideoPlatform('https://www.youtube.com/watch?v=abc123'), 'youtube');
});

test('falls back to other for unrecognized hosts', () => {
  assert.equal(detectVideoPlatform('https://example.com/recipe-video'), 'other');
});

test('returns null for null input', () => {
  assert.equal(detectVideoPlatform(null), null);
});

test('returns other for unparseable url', () => {
  assert.equal(detectVideoPlatform('not-a-url'), 'other');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test --experimental-strip-types src/utils/videoPlatform.test.ts`
Expected: FAIL — `Cannot find module './videoPlatform.js'`

- [ ] **Step 3: Write implementation**

```typescript
export type VideoPlatform = 'tiktok' | 'instagram' | 'youtube' | 'other';

export function detectVideoPlatform(url: string | null | undefined): VideoPlatform | null {
  if (!url) {
    return null;
  }
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  if (hostname.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (hostname.includes('instagram.com')) {
    return 'instagram';
  }
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'youtube';
  }
  return 'other';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test --experimental-strip-types src/utils/videoPlatform.test.ts`
Expected: PASS, 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/videoPlatform.ts backend/src/utils/videoPlatform.test.ts
git commit -m "feat(backend): add video platform detection utility"
```

---

### Task 4: Rewrite `services/recipes.ts` for versioned model

**Files:**
- Modify: `backend/src/services/recipes.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
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

async function assembleStoredRecipe(
  recipeRow: RecipeRow,
  isFavorite: boolean,
): Promise<StoredRecipe> {
  const versionRows = await db
    .select()
    .from(recipeVersions)
    .where(eq(recipeVersions.recipeId, recipeRow.id))
    .orderBy(asc(recipeVersions.versionNumber));

  const versions = versionRows.map(rowToVersion);
  const current =
    versions.find((v) => v.id === recipeRow.currentVersionId) ?? versions[versions.length - 1];

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
  return db.transaction(async (tx) => {
    const [recipeRow] = await tx
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), or(isNull(recipes.ownerUserId), eq(recipes.ownerUserId, userId))))
      .limit(1);
    if (!recipeRow) {
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
      await tx.update(recipes).set({ currentVersionId: versionRow!.id, updatedAt: new Date() }).where(eq(recipes.id, recipeId));
    }

    const [refreshed] = await tx.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
    const favRow = await tx
      .select({ isFavorite: cookbookItems.isFavorite })
      .from(cookbookItems)
      .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeId)))
      .limit(1);

    return assembleStoredRecipe(refreshed!, favRow[0]?.isFavorite ?? false);
  });
}

export async function setCurrentVersion(
  recipeId: string,
  userId: string,
  versionId: string,
): Promise<StoredRecipe | null> {
  return db.transaction(async (tx) => {
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
    if (!refreshed) return null;
    const favRow = await tx
      .select({ isFavorite: cookbookItems.isFavorite })
      .from(cookbookItems)
      .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeId)))
      .limit(1);
    return assembleStoredRecipe(refreshed, favRow[0]?.isFavorite ?? false);
  });
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
  return db.transaction(async (tx) => {
    const [recipeRow] = await tx
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), or(isNull(recipes.ownerUserId), eq(recipes.ownerUserId, userId))))
      .limit(1);
    if (!recipeRow) {
      return { deletedRecipe: false, recipe: null };
    }

    const remaining = await tx
      .select()
      .from(recipeVersions)
      .where(eq(recipeVersions.recipeId, recipeId))
      .orderBy(asc(recipeVersions.versionNumber));

    const isLastVersion = remaining.length <= 1;
    if (isLastVersion) {
      await tx.delete(recipes).where(eq(recipes.id, recipeId));
      return { deletedRecipe: true, recipe: null };
    }

    await tx.delete(recipeVersions).where(eq(recipeVersions.id, versionId));

    let currentVersionId = recipeRow.currentVersionId;
    if (currentVersionId === versionId) {
      const fallback = remaining.filter((v) => v.id !== versionId).slice(-1)[0];
      currentVersionId = fallback ? fallback.id : null;
    }
    await tx.update(recipes).set({ currentVersionId, updatedAt: new Date() }).where(eq(recipes.id, recipeId));

    const [refreshed] = await tx.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
    const favRow = await tx
      .select({ isFavorite: cookbookItems.isFavorite })
      .from(cookbookItems)
      .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeId)))
      .limit(1);

    return { deletedRecipe: false, recipe: await assembleStoredRecipe(refreshed!, favRow[0]?.isFavorite ?? false) };
  });
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
  const favRow = await db
    .select({ isFavorite: cookbookItems.isFavorite })
    .from(cookbookItems)
    .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeId)))
    .limit(1);
  return assembleStoredRecipe(recipeRow, favRow[0]?.isFavorite ?? false);
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

export async function setVideoLink(recipeId: string, userId: string, videoUrl: string | null): Promise<StoredRecipe | null> {
  const [updated] = await db
    .update(recipes)
    .set({ videoUrl, videoPlatform: detectVideoPlatform(videoUrl), updatedAt: new Date() })
    .where(and(eq(recipes.id, recipeId), or(isNull(recipes.ownerUserId), eq(recipes.ownerUserId, userId))))
    .returning();
  if (!updated) return null;
  const favRow = await db
    .select({ isFavorite: cookbookItems.isFavorite })
    .from(cookbookItems)
    .where(and(eq(cookbookItems.userId, userId), eq(cookbookItems.recipeId, recipeId)))
    .limit(1);
  return assembleStoredRecipe(updated, favRow[0]?.isFavorite ?? false);
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
```

Note: `ensureRecipeAndSaveToCookbook` (client-generated-recipe-with-id save path used by Quick Generate) is intentionally removed here — Quick Generate results no longer arrive pre-formed with a client-side `Recipe` object with substitutions; Task 6 updates `app.ts` to call `createRecipeForUser` + `saveRecipeToCookbook` instead. This is called out explicitly so the route-layer task isn't a surprise.

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/recipes.ts
git commit -m "feat(backend): rewrite recipes service for versioned data model"
```

---

### Task 5: Preferences service

**Files:**
- Create: `backend/src/services/preferences.ts`

- [ ] **Step 1: Write the service**

```typescript
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
        ...(update.notify_product_updates !== undefined ? { notifyProductUpdates: update.notify_product_updates } : {}),
      },
    });
  return getPreferences(userId);
}

export async function getPlan(userId: string): Promise<string> {
  const [row] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.plan ?? 'free';
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/preferences.ts
git commit -m "feat(backend): add user preferences service"
```

---

### Task 6: Routes — versioned recipe endpoints, delete, favorite, video, preferences

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Update imports**

Replace the recipes-service import block:

```typescript
import {
  addRecipeVersion,
  createRecipeForUser,
  deleteRecipe,
  deleteRecipeVersion,
  getRecipeByIdForUser,
  listCookbook,
  removeFromCookbook,
  reorderCookbook,
  saveRecipeToCookbook,
  setCurrentVersion,
  setFavorite,
  setVideoLink,
} from './services/recipes.js';
import { getPreferences, getPlan, updatePreferences } from './services/preferences.js';
```

Add to the `types/recipe.js` import block:

```typescript
  addRecipeVersionSchema,
  createRecipeSchema,
  updateVideoLinkSchema,
```

Remove `cookbookSaveSchema` from that import list (no longer used — replaced by `createRecipeSchema`) and remove the now-unused `buildRecipePayload` function and its call sites (Step 2 replaces every caller).

- [ ] **Step 2: Replace recipe/cookbook routes**

Replace the block from `app.get('/v1/recipes/:id', ...)` through `app.delete('/v1/cookbook/items/:recipeId', ...)` (inclusive) with:

```typescript
  app.get('/v1/recipes/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error.flatten());
    }
    const recipe = await getRecipeByIdForUser(params.data.id, request.auth.userId);
    if (!recipe) {
      return reply.notFound('Recipe not found');
    }
    return reply.send({ recipe });
  });

  app.post('/v1/recipes', async (request, reply) => {
    const parsed = createRecipeSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }
    const recipe = await createRecipeForUser(request.auth.userId, parsed.data);
    await saveRecipeToCookbook(request.auth.userId, recipe.id);
    return reply.send({ recipe });
  });

  app.post('/v1/recipes/:id/versions', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = addRecipeVersionSchema.safeParse(request.body);
    if (!params.success) return sendValidationError(reply, params.error.flatten());
    if (!body.success) return sendValidationError(reply, body.error.flatten());

    const recipe = await addRecipeVersion(params.data.id, request.auth.userId, body.data);
    if (!recipe) return reply.notFound('Recipe not found');
    return reply.send({ recipe });
  });

  app.patch('/v1/recipes/:id/current-version', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ version_id: z.string().uuid() }).safeParse(request.body);
    if (!params.success) return sendValidationError(reply, params.error.flatten());
    if (!body.success) return sendValidationError(reply, body.error.flatten());

    const recipe = await setCurrentVersion(params.data.id, request.auth.userId, body.data.version_id);
    if (!recipe) return reply.notFound('Recipe or version not found');
    return reply.send({ recipe });
  });

  app.delete('/v1/recipes/:id/versions/:versionId', async (request, reply) => {
    const params = z
      .object({ id: z.string().uuid(), versionId: z.string().uuid() })
      .safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error.flatten());

    const result = await deleteRecipeVersion(params.data.id, request.auth.userId, params.data.versionId);
    if (!result.deletedRecipe && !result.recipe) {
      return reply.notFound('Recipe not found');
    }
    return reply.send(result);
  });

  app.delete('/v1/recipes/:id', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return sendValidationError(reply, params.error.flatten());

    const deleted = await deleteRecipe(params.data.id, request.auth.userId);
    if (!deleted) return reply.notFound('Recipe not found');
    return reply.send({ ok: true });
  });

  app.put('/v1/recipes/:id/video-link', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = updateVideoLinkSchema.safeParse(request.body);
    if (!params.success) return sendValidationError(reply, params.error.flatten());
    if (!body.success) return sendValidationError(reply, body.error.flatten());

    const recipe = await setVideoLink(params.data.id, request.auth.userId, body.data.video_url);
    if (!recipe) return reply.notFound('Recipe not found');
    return reply.send({ recipe });
  });

  app.put('/v1/cookbook/items/:recipeId/favorite', async (request, reply) => {
    const params = z.object({ recipeId: z.string().uuid() }).safeParse(request.params);
    const body = z.object({ is_favorite: z.boolean() }).safeParse(request.body);
    if (!params.success) return sendValidationError(reply, params.error.flatten());
    if (!body.success) return sendValidationError(reply, body.error.flatten());

    await setFavorite(request.auth.userId, params.data.recipeId, body.data.is_favorite);
    return reply.send({ ok: true });
  });

  app.get('/v1/cookbook', async (request) => {
    const list = await listCookbook(request.auth.userId);
    return { recipes: list };
  });

  app.patch('/v1/cookbook/items/reorder', async (request, reply) => {
    const parsed = cookbookReorderSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }
    await reorderCookbook(request.auth.userId, parsed.data.recipeIds);
    return { ok: true };
  });

  app.delete('/v1/cookbook/items/:recipeId', async (request, reply) => {
    const parsed = z.object({ recipeId: z.string().uuid() }).safeParse(request.params);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }
    await removeFromCookbook(request.auth.userId, parsed.data.recipeId);
    return { ok: true };
  });

  app.get('/v1/preferences', async (request) => {
    const preferences = await getPreferences(request.auth.userId);
    const plan = await getPlan(request.auth.userId);
    return { preferences, plan };
  });

  app.patch('/v1/preferences', async (request, reply) => {
    const parsed = z
      .object({
        diet: z.string().nullable().optional(),
        avoid: z.array(z.string()).optional(),
        notify_recipe_saved: z.boolean().optional(),
        notify_weekly_digest: z.boolean().optional(),
        notify_product_updates: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error.flatten());
    const preferences = await updatePreferences(request.auth.userId, parsed.data);
    return { preferences };
  });
```

- [ ] **Step 3: Fix the `import-url` route's now-broken call**

The existing `app.post('/v1/recipes/import-url', ...)` handler calls `createRecipeForUser` and `ensureRecipeAndSaveToCookbook` with the old flat-recipe shape. Replace that handler body with:

```typescript
  app.post('/v1/recipes/import-url', async (request, reply) => {
    const parsed = importUrlSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    const imported = await importRecipeFromUrl(parsed.data.url, allowedImportDomains);
    const recipe = await createRecipeForUser(request.auth.userId, {
      title: imported.title,
      cuisine: imported.cuisine,
      servings: imported.servings,
      total_time_minutes: imported.total_time_minutes,
      difficulty: imported.difficulty,
      short_hook: imported.short_hook,
      dietary_tags: imported.dietary_tags,
      allergen_warnings: imported.allergen_warnings,
      ingredients: imported.ingredients,
      steps: imported.steps,
      source_type: 'link',
      source_url: imported.source_url,
    });
    await saveRecipeToCookbook(request.auth.userId, recipe.id);

    return { recipe };
  });
```

Check `backend/src/services/importer.ts`'s return type against these field names (`imported.title`, etc.) and adjust field access to match its actual export shape if it differs — read the file before finalizing this step.

- [ ] **Step 4: Fix `/v1/recipes/generate` and `/v1/recipes/generate-summaries` response building**

These two routes still use `buildRecipePayload`, which referenced the now-removed flat `substitutions`/`ingredients`/`steps` columns as a *persistence* shape — but here they're building an in-memory AI response payload, not a DB row, so `buildRecipePayload` itself doesn't need to change (it maps from the Zod `Recipe` AI-output type, untouched by this plan). Leave `buildRecipePayload` and these two routes as-is. (This step exists to confirm — after Step 1 you may have deleted `buildRecipePayload` by mistake reading Step 1's instruction; if so, restore it. Only `cookbookSaveSchema`'s import should be removed, not `buildRecipePayload`.)

- [ ] **Step 5: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS with 0 errors. If errors remain, they will point at exact remaining call sites of removed functions (`ensureRecipeAndSaveToCookbook`) — fix by using `createRecipeForUser` + `saveRecipeToCookbook` at that call site.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat(backend): wire versioned recipe routes, delete/favorite/video/preferences endpoints"
```

---

### Task 7: Final backend validation

- [ ] **Step 1: Full typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS, 0 errors.

- [ ] **Step 2: Run unit tests**

Run: `cd backend && npm test`
Expected: PASS (includes `videoPlatform.test.ts` from Task 3).

- [ ] **Step 3: Build**

Run: `cd backend && npm run build`
Expected: PASS, `backend/dist/` produced with no emit errors.

- [ ] **Step 4: Commit any residual fixes, then stop — do not run `db:migrate` (no configured dev database in this environment).**
