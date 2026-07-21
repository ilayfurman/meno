import Fastify from 'fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import { PDFParse } from 'pdf-parse';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authGuard } from './plugins/auth.js';
import { db } from './db/client.js';
import { aiUsage, generationRequests, recipeEvents } from './db/schema.js';
import {
  addRecipeVersionSchema,
  agentRequestSchema,
  ALLOWED_PHOTO_MIME_TYPES,
  cookbookReorderSchema,
  createRecipeSchema,
  eventCreateSchema,
  generationRequestSchema,
  hydrationRequestSchema,
  importImageSchema,
  importTextSchema,
  importUrlSchema,
  recipeSummaryListSchema,
  updateRecipeLinksSchema,
  updateRecipePhotoSchema,
  updateRecipeVersionSchema,
  type Recipe,
} from './types/recipe.js';
import {
  askAgent,
  generateRecipeSummariesWithAi,
  generateRecipesWithAi,
  hydrateRecipeFromSummaryWithAi,
  structureRecipeFromImage,
  structureRecipeFromText,
} from './services/openai.js';
import {
  addRecipeVersion,
  createRecipeForUser,
  deleteRecipe,
  deleteRecipeVersion,
  findDuplicateBySourceUrl,
  findDuplicateByTitle,
  getRecipeByIdForUser,
  getRecipePhotoDataUrl,
  verifyPhotoUrlSignature,
  getVersionContent,
  parseDataUrl,
  getCookbookStats,
  listCookbookCuisines,
  listCookbookPage,
  removeFromCookbook,
  reorderCookbook,
  saveRecipeToCookbook,
  setCurrentVersion,
  setFavorite,
  setRecipeLinks,
  setRecipePhoto,
  updateRecipeVersion,
} from './services/recipes.js';
import { getPlan, getPreferences, updatePreferences } from './services/preferences.js';
import { allowedImportDomains, env } from './config/env.js';
import { extractRecipeFromJsonLd, fetchRecipePage, htmlToReadableText } from './services/importer.js';

const idempotencyHeaderSchema = z.string().min(8);

const generationRateWindow = new Map<string, number[]>();

function applyPerMinuteLimit(userId: string) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const existing = generationRateWindow.get(userId) ?? [];
  const next = existing.filter((ts) => ts >= windowStart);
  if (next.length >= env.GEN_RATE_LIMIT_PER_MINUTE) {
    return false;
  }
  next.push(now);
  generationRateWindow.set(userId, next);
  return true;
}

async function enforceDailyLimit(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ c: count() })
    .from(generationRequests)
    .where(and(eq(generationRequests.userId, userId), gte(generationRequests.createdAt, since)));

  const total = rows[0]?.c ?? 0;
  return total < env.GEN_DAILY_LIMIT;
}

function buildRecipePayload(recipe: Recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    cuisine: recipe.cuisine,
    servings: recipe.servings,
    total_time_minutes: recipe.total_time_minutes,
    difficulty: recipe.difficulty,
    short_hook: recipe.short_hook,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    substitutions: recipe.substitutions,
    dietary_tags: recipe.dietary_tags,
    allergen_warnings: recipe.allergen_warnings,
    completion_state: 'full' as const,
  };
}

function buildSummaryPayload(summary: {
  id: string;
  title: string;
  cuisine: string;
  servings_hint: number | null;
  total_time_minutes: number;
  difficulty: string;
  short_hook: string;
  dietary_tags: string[];
  allergen_warnings: string[];
}) {
  return {
    id: summary.id,
    title: summary.title,
    cuisine: summary.cuisine,
    servings_hint: summary.servings_hint,
    total_time_minutes: summary.total_time_minutes,
    difficulty: summary.difficulty,
    short_hook: summary.short_hook,
    dietary_tags: summary.dietary_tags,
    allergen_warnings: summary.allergen_warnings,
  };
}

function sendValidationError(reply: { code: (status: number) => { send: (payload: unknown) => unknown } }, details: unknown) {
  return reply.code(400).send({ error: 'Invalid request', details });
}

const versionsQuerySchema = z.object({ versions: z.enum(['summary', 'full']).optional() });

// Every route below that can return a StoredRecipe defaults to the ORIGINAL
// full-versions shape (every past version's ingredients/steps included)
// unless the caller explicitly opts into the smaller one via
// `?versions=summary`. That default is what lets the app build that's
// already on a user's device -- which has no idea this query param exists,
// and reads `versions[i].ingredients` directly with no on-demand fallback --
// keep working completely unmodified after this backend deploys, no matter
// how long it takes them to update. Only a client that's been rebuilt
// against this change (and therefore knows to fetch missing version content
// via GET /v1/recipes/:id/versions/:versionId) should ever pass `summary`.
function wantsLeanVersions(query: unknown): boolean {
  const parsed = versionsQuerySchema.safeParse(query);
  return parsed.success && parsed.data.versions === 'summary';
}

export function createApp() {
  // Default bodyLimit (1MB) is too small for a base64-encoded recipe photo
  // JSON payload -- bump it so the photo-upload route (image_url as a data:
  // URL) doesn't get rejected before it even reaches our own size checks.
  const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });

  void app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  // Compresses JSON responses (recipe text, cookbook pages) so larger
  // payloads transfer faster over the phone's connection. Global threshold
  // keeps it from bothering with tiny responses where gzip overhead isn't
  // worth it.
  void app.register(compress, { global: true, threshold: 1024 });
  void app.register(sensible);
  void app.register(multipart, {
    limits: { fileSize: env.MAX_IMPORT_RESPONSE_BYTES },
  });

  app.get('/health', async () => ({ ok: true }));

  // Registered before the authGuard hook below, so this route is reachable
  // with no Clerk session -- required for a plain <Image source={{uri}}> to
  // load it. It's NOT unauthenticated, though: `sig` is an HMAC signature
  // (see signPhotoUrl/verifyPhotoUrlSignature in services/recipes.ts) that
  // only the server can produce, and only ever does so inside an
  // authenticated response. A request without a valid signature for that
  // exact id+v pair is rejected before ever touching the database.
  app.get('/v1/recipes/:id/photo', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const query = z.object({ v: z.string().min(1), sig: z.string().min(1) }).safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(404).send();
    }
    const version = Number(query.data.v);
    if (!Number.isFinite(version) || !verifyPhotoUrlSignature(params.data.id, version, query.data.sig)) {
      return reply.code(403).send();
    }
    const photo = await getRecipePhotoDataUrl(params.data.id);
    if (!photo) {
      return reply.code(404).send();
    }
    // The signature alone only proves this id+v pair was legitimately
    // issued at some point -- it doesn't prove `v` still matches what's
    // actually stored now. Rejecting a mismatch here is what makes
    // replacing/removing a photo actually revoke any previously-issued URL
    // for it, instead of that old URL just quietly starting to resolve to
    // whatever photo happens to be current.
    if (photo.updatedAt.getTime() !== version) {
      return reply.code(403).send();
    }
    const parsed = parseDataUrl(photo.dataUrl);
    if (!parsed || !ALLOWED_PHOTO_MIME_TYPES.includes(parsed.contentType as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])) {
      return reply.code(404).send();
    }
    reply.header('Cache-Control', 'private, max-age=31536000, immutable');
    // Defense-in-depth alongside the write-time allowlist in
    // updateRecipePhotoSchema -- if a non-image data: URL ever ends up
    // stored anyway (e.g. a row written before this check existed), this
    // stops a browser from sniffing the body and rendering it as HTML/SVG
    // regardless of the Content-Type we send.
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.type(parsed.contentType);
    return reply.send(parsed.buffer);
  });

  // Everything below requires a real Clerk session. This is registered as
  // a CHILD encapsulation scope (app.register(async (app) => ...)) rather
  // than a plain `app.addHook('onRequest', authGuard)` at the root --
  // Fastify resolves which hooks apply to which routes against the whole
  // route tree at boot (`.ready()`) time, not in the textual order things
  // were declared in this file. A hook added with `addHook` at the root
  // applies to EVERY route in that same root context, including ones
  // written earlier in the file -- like the public /v1/recipes/:id/photo
  // route above, which would have started getting rejected by this same
  // hook the moment this deployed, since React Native's <Image> can't send
  // an Authorization header. Registering the hook inside a child scope
  // instead means it only applies to routes declared inside this callback,
  // leaving true siblings (photo, /health) genuinely untouched by it.
  void app.register(async (app) => {
    app.addHook('onRequest', authGuard);

    app.post('/v1/auth/bootstrap', async (request) => {
      return {
        userId: request.auth.userId,
        clerkUserId: request.auth.clerkUserId,
      };
    });

    app.post('/v1/recipes/generate', async (request, reply) => {
      const parsed = generationRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const idempotencyHeader = request.headers['idempotency-key'];
      const idempotencyResult = idempotencyHeaderSchema.safeParse(idempotencyHeader);
      if (!idempotencyResult.success) {
        return sendValidationError(reply, { error: 'Idempotency-Key header is required.' });
      }

      if (!applyPerMinuteLimit(request.auth.userId)) {
        return reply.tooManyRequests('Generation rate limit exceeded.');
      }

      if (!(await enforceDailyLimit(request.auth.userId))) {
        return reply.forbidden('Daily generation limit reached.');
      }

      const existingRequest = await db
        .select()
        .from(generationRequests)
        .where(
          and(
            eq(generationRequests.userId, request.auth.userId),
            eq(generationRequests.idempotencyKey, idempotencyResult.data),
          ),
        )
        .limit(1);

      if (existingRequest[0]?.status === 'success' && existingRequest[0].responseJson) {
        return reply.send(existingRequest[0].responseJson);
      }

      const requestHash = JSON.stringify(parsed.data);

      try {
        const ai = await generateRecipesWithAi(parsed.data);

        const responseJson = {
          recipes: ai.recipes.map(buildRecipePayload),
        };

        await db
          .insert(generationRequests)
          .values({
            userId: request.auth.userId,
            idempotencyKey: idempotencyResult.data,
            requestHash,
            status: 'success',
            responseJson,
            completedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [generationRequests.userId, generationRequests.idempotencyKey],
            set: {
              status: 'success',
              responseJson,
              requestHash,
              completedAt: new Date(),
            },
          });

        await db.insert(aiUsage).values({
          userId: request.auth.userId,
          endpoint: '/v1/recipes/generate',
          model: env.GROQ_MODEL,
          inputTokens: ai.usage?.prompt_tokens ?? 0,
          outputTokens: ai.usage?.completion_tokens ?? 0,
          costEstimateUsd: '0.000000',
        });

        return reply.send(responseJson);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        await db
          .insert(generationRequests)
          .values({
            userId: request.auth.userId,
            idempotencyKey: idempotencyResult.data,
            requestHash,
            status: 'failed',
            error: message,
            completedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [generationRequests.userId, generationRequests.idempotencyKey],
            set: {
              status: 'failed',
              error: message,
              completedAt: new Date(),
            },
          });
        return reply.internalServerError(message);
      }
    });

    app.post('/v1/recipes/generate-summaries', async (request, reply) => {
      const parsed = generationRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const idempotencyHeader = request.headers['idempotency-key'];
      const idempotencyResult = idempotencyHeaderSchema.safeParse(idempotencyHeader);
      if (!idempotencyResult.success) {
        return sendValidationError(reply, { error: 'Idempotency-Key header is required.' });
      }

      if (!applyPerMinuteLimit(request.auth.userId)) {
        return reply.tooManyRequests('Generation rate limit exceeded.');
      }
      if (!(await enforceDailyLimit(request.auth.userId))) {
        return reply.forbidden('Daily generation limit reached.');
      }

      const existingRequest = await db
        .select()
        .from(generationRequests)
        .where(
          and(
            eq(generationRequests.userId, request.auth.userId),
            eq(generationRequests.idempotencyKey, idempotencyResult.data),
          ),
        )
        .limit(1);

      if (existingRequest[0]?.status === 'success' && existingRequest[0].responseJson) {
        return reply.send(existingRequest[0].responseJson);
      }

      const requestHash = JSON.stringify(parsed.data);
      try {
        const ai = await generateRecipeSummariesWithAi(parsed.data);
        const responseJson = {
          recipes: recipeSummaryListSchema.parse({ recipes: ai.recipes }).recipes.map(buildSummaryPayload),
        };

        await db
          .insert(generationRequests)
          .values({
            userId: request.auth.userId,
            idempotencyKey: idempotencyResult.data,
            requestHash,
            status: 'success',
            responseJson,
            completedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [generationRequests.userId, generationRequests.idempotencyKey],
            set: {
              status: 'success',
              responseJson,
              requestHash,
              completedAt: new Date(),
            },
          });

        await db.insert(aiUsage).values({
          userId: request.auth.userId,
          endpoint: '/v1/recipes/generate-summaries',
          model: env.GROQ_MODEL,
          inputTokens: ai.usage?.prompt_tokens ?? 0,
          outputTokens: ai.usage?.completion_tokens ?? 0,
          costEstimateUsd: '0.000000',
        });

        return reply.send(responseJson);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Summary generation failed';
        await db
          .insert(generationRequests)
          .values({
            userId: request.auth.userId,
            idempotencyKey: idempotencyResult.data,
            requestHash,
            status: 'failed',
            error: message,
            completedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [generationRequests.userId, generationRequests.idempotencyKey],
            set: {
              status: 'failed',
              error: message,
              completedAt: new Date(),
            },
          });
        return reply.internalServerError(message);
      }
    });

    app.post('/v1/recipes/hydrate-recipe', async (request, reply) => {
      const parsed = hydrationRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      try {
        const ai = await hydrateRecipeFromSummaryWithAi(parsed.data);
        const recipe = ai.recipes[0];
        if (!recipe) {
          return reply.internalServerError('Recipe hydration returned no recipe.');
        }
        await db.insert(aiUsage).values({
          userId: request.auth.userId,
          endpoint: '/v1/recipes/hydrate-recipe',
          model: env.GROQ_MODEL,
          inputTokens: ai.usage?.prompt_tokens ?? 0,
          outputTokens: ai.usage?.completion_tokens ?? 0,
          costEstimateUsd: '0.000000',
        });
        return reply.send({ recipe: buildRecipePayload({ ...recipe, id: parsed.data.summary.id }) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Recipe hydration failed';
        return reply.internalServerError(message);
      }
    });

    app.get('/v1/recipes/:id', async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error.flatten());
      }
      const recipe = await getRecipeByIdForUser(params.data.id, request.auth.userId, wantsLeanVersions(request.query));
      if (!recipe) {
        return reply.notFound('Recipe not found');
      }
      return reply.send({ recipe });
    });

    // On-demand fetch for a single past version's full ingredients/steps --
    // the recipe's own `versions` array only carries summaries now (see the
    // comment on assembleStoredRecipe), so browsing to an older version pill
    // calls this instead of that content already having been sent eagerly.
    app.get('/v1/recipes/:id/versions/:versionId', async (request, reply) => {
      const params = z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error.flatten());
      }
      const version = await getVersionContent(params.data.id, request.auth.userId, params.data.versionId);
      if (!version) {
        return reply.notFound('Version not found');
      }
      return reply.send({ version });
    });

    app.post('/v1/recipes', async (request, reply) => {
      const parsed = createRecipeSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }
      const recipe = await createRecipeForUser(request.auth.userId, parsed.data, wantsLeanVersions(request.query));
      await saveRecipeToCookbook(request.auth.userId, recipe.id);
      return reply.send({ recipe });
    });

    app.post('/v1/recipes/:id/versions', async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const body = addRecipeVersionSchema.safeParse(request.body);
      if (!params.success) return sendValidationError(reply, params.error.flatten());
      if (!body.success) return sendValidationError(reply, body.error.flatten());

      const recipe = await addRecipeVersion(params.data.id, request.auth.userId, body.data, wantsLeanVersions(request.query));
      if (!recipe) return reply.notFound('Recipe not found');
      return reply.send({ recipe });
    });

    app.patch('/v1/recipes/:id/versions/:versionId', async (request, reply) => {
      const params = z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).safeParse(request.params);
      const body = updateRecipeVersionSchema.safeParse(request.body);
      if (!params.success) return sendValidationError(reply, params.error.flatten());
      if (!body.success) return sendValidationError(reply, body.error.flatten());

      const recipe = await updateRecipeVersion(
        params.data.id,
        request.auth.userId,
        params.data.versionId,
        body.data,
        wantsLeanVersions(request.query),
      );
      if (!recipe) return reply.notFound('Recipe or version not found');
      return reply.send({ recipe });
    });

    app.patch('/v1/recipes/:id/current-version', async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const body = z.object({ version_id: z.string().uuid() }).safeParse(request.body);
      if (!params.success) return sendValidationError(reply, params.error.flatten());
      if (!body.success) return sendValidationError(reply, body.error.flatten());

      const recipe = await setCurrentVersion(
        params.data.id,
        request.auth.userId,
        body.data.version_id,
        wantsLeanVersions(request.query),
      );
      if (!recipe) return reply.notFound('Recipe or version not found');
      return reply.send({ recipe });
    });

    app.delete('/v1/recipes/:id/versions/:versionId', async (request, reply) => {
      const params = z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).safeParse(request.params);
      if (!params.success) return sendValidationError(reply, params.error.flatten());

      const result = await deleteRecipeVersion(
        params.data.id,
        request.auth.userId,
        params.data.versionId,
        wantsLeanVersions(request.query),
      );
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

    app.put('/v1/recipes/:id/links', async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const body = updateRecipeLinksSchema.safeParse(request.body);
      if (!params.success) return sendValidationError(reply, params.error.flatten());
      if (!body.success) return sendValidationError(reply, body.error.flatten());

      const recipe = await setRecipeLinks(params.data.id, request.auth.userId, body.data.links, wantsLeanVersions(request.query));
      if (!recipe) return reply.notFound('Recipe not found');
      return reply.send({ recipe });
    });

    app.put('/v1/recipes/:id/photo', async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const body = updateRecipePhotoSchema.safeParse(request.body);
      if (!params.success) return sendValidationError(reply, params.error.flatten());
      if (!body.success) return sendValidationError(reply, body.error.flatten());

      const recipe = await setRecipePhoto(params.data.id, request.auth.userId, body.data.image_url, wantsLeanVersions(request.query));
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

    app.get('/v1/cookbook', async (request, reply) => {
      const query = z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(24),
          offset: z.coerce.number().int().min(0).default(0),
          search: z.string().trim().max(200).optional(),
          filter: z.string().trim().max(100).optional(),
          sort: z.enum(['recent', 'title_asc', 'time_asc', 'time_desc']).default('recent'),
        })
        .safeParse(request.query);
      if (!query.success) return sendValidationError(reply, query.error.flatten());

      const { items, hasMore } = await listCookbookPage(request.auth.userId, query.data);
      return { recipes: items, has_more: hasMore };
    });

    app.get('/v1/cookbook/stats', async (request) => {
      return getCookbookStats(request.auth.userId);
    });

    app.get('/v1/cookbook/cuisines', async (request) => {
      const cuisines = await listCookbookCuisines(request.auth.userId);
      return { cuisines };
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

    app.post('/v1/recipes/events', async (request, reply) => {
      const parsed = eventCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      await db.insert(recipeEvents).values({
        userId: request.auth.userId,
        recipeId: parsed.data.recipeId,
        eventType: parsed.data.eventType,
        metadata: parsed.data.metadata,
      });

      return { ok: true };
    });

    app.post('/v1/recipes/agent', async (request, reply) => {
      const parsed = agentRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const limitedRecipes = parsed.data.recipes.slice(0, env.MAX_AGENT_RECIPES);

      const result = await askAgent(parsed.data.question, limitedRecipes);

      await db.insert(aiUsage).values({
        userId: request.auth.userId,
        endpoint: '/v1/recipes/agent',
        model: env.GROQ_MODEL,
        inputTokens: result.usage?.prompt_tokens ?? 0,
        outputTokens: result.usage?.completion_tokens ?? 0,
        costEstimateUsd: '0.000000',
      });

      return { answer: result.text };
    });

    app.post('/v1/recipes/import-url', async (request, reply) => {
      const parsed = importUrlSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const page = await fetchRecipePage(parsed.data.url, allowedImportDomains);

      // Free path first: most established recipe sites embed schema.org
      // Recipe JSON-LD, which we can parse directly with zero AI cost. Only
      // fall back to the LLM ("read the page and extract the recipe") when
      // that markup isn't there -- keeps imports fast/free on the sites that
      // support it while still working on ones that don't.
      const imported = extractRecipeFromJsonLd(page);
      if (imported) {
        const candidate = {
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
          source_type: 'link' as const,
          source_url: imported.source_url,
        };
        if (!parsed.data.force) {
          const duplicate = await findDuplicateBySourceUrl(request.auth.userId, imported.source_url);
          if (duplicate) {
            return { duplicate, candidate };
          }
        }
        const recipe = await createRecipeForUser(request.auth.userId, candidate, wantsLeanVersions(request.query));
        await saveRecipeToCookbook(request.auth.userId, recipe.id);
        return { recipe };
      }

      const pageText = htmlToReadableText(page.html);
      // Cheap guard before ever paying for an AI call: a page that came back
      // (almost) empty -- e.g. Instagram/TikTok serving a login wall or JS
      // shell instead of real content to a scraper -- has nothing worth
      // extracting. Catching it here avoids the round-trip entirely for the
      // most common blocked-site case.
      if (pageText.length < 60) {
        return reply
          .code(422)
          .send({ error: "Couldn't find any recipe content on that page. Some sites (like Instagram or TikTok) block outside access entirely -- try pasting a screenshot instead." });
      }

      const extracted = await structureRecipeFromText(pageText);
      await db.insert(aiUsage).values({
        userId: request.auth.userId,
        endpoint: '/v1/recipes/import-url',
        model: env.GROQ_MODEL,
        inputTokens: extracted.usage?.prompt_tokens ?? 0,
        outputTokens: extracted.usage?.completion_tokens ?? 0,
        costEstimateUsd: '0.000000',
      });
      if (!extracted.recipe.recipe_found) {
        return reply
          .code(422)
          .send({ error: "Couldn't find a recipe on that page -- there wasn't enough real recipe content to extract." });
      }

      const candidate = { ...extracted.recipe, source_type: 'link' as const, source_url: page.url };
      if (!parsed.data.force) {
        const duplicate = await findDuplicateBySourceUrl(request.auth.userId, page.url);
        if (duplicate) {
          return { duplicate, candidate };
        }
      }
      const recipe = await createRecipeForUser(request.auth.userId, candidate, wantsLeanVersions(request.query));
      await saveRecipeToCookbook(request.auth.userId, recipe.id);

      return { recipe };
    });

    app.post('/v1/recipes/import-text', async (request, reply) => {
      const parsed = importTextSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }

      const extracted = await structureRecipeFromText(parsed.data.text);
      await db.insert(aiUsage).values({
        userId: request.auth.userId,
        endpoint: '/v1/recipes/import-text',
        model: env.GROQ_MODEL,
        inputTokens: extracted.usage?.prompt_tokens ?? 0,
        outputTokens: extracted.usage?.completion_tokens ?? 0,
        costEstimateUsd: '0.000000',
      });
      if (!extracted.recipe.recipe_found) {
        return reply
          .code(422)
          .send({ error: "Couldn't find a recipe in that text -- there wasn't enough real recipe content to extract." });
      }

      const candidate = { ...extracted.recipe, source_type: 'text' as const };

      if (!parsed.data.force) {
        const duplicate = await findDuplicateByTitle(request.auth.userId, candidate.title);
        if (duplicate) {
          return { duplicate, candidate };
        }
      }

      const recipe = await createRecipeForUser(request.auth.userId, candidate, wantsLeanVersions(request.query));
      await saveRecipeToCookbook(request.auth.userId, recipe.id);
      return { recipe };
    });

    app.post('/v1/recipes/import-pdf', async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: 'No file uploaded.' });
      }
      if (file.mimetype !== 'application/pdf') {
        return reply.code(400).send({ error: 'Only PDF files are supported.' });
      }

      const buffer = await file.toBuffer();
      const parser = new PDFParse({ data: buffer });
      let text: string;
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }

      if (!text.trim()) {
        return reply.code(400).send({ error: 'Could not extract any text from this PDF.' });
      }

      // request.file() surfaces any other multipart fields sent alongside the
      // file on file.fields -- each as { value } -- rather than as a typed
      // request.body the way a plain JSON route would.
      const forceField = (file.fields as Record<string, { value?: unknown } | undefined>).force;
      const force = typeof forceField?.value === 'string' && forceField.value === 'true';

      const extracted = await structureRecipeFromText(text);
      await db.insert(aiUsage).values({
        userId: request.auth.userId,
        endpoint: '/v1/recipes/import-pdf',
        model: env.GROQ_MODEL,
        inputTokens: extracted.usage?.prompt_tokens ?? 0,
        outputTokens: extracted.usage?.completion_tokens ?? 0,
        costEstimateUsd: '0.000000',
      });
      if (!extracted.recipe.recipe_found) {
        return reply
          .code(422)
          .send({ error: "Couldn't find a recipe in that PDF -- there wasn't enough real recipe content to extract." });
      }

      const candidate = { ...extracted.recipe, source_type: 'pdf' as const };

      if (!force) {
        const duplicate = await findDuplicateByTitle(request.auth.userId, candidate.title);
        if (duplicate) {
          return { duplicate, candidate };
        }
      }

      const recipe = await createRecipeForUser(request.auth.userId, candidate, wantsLeanVersions(request.query));
      await saveRecipeToCookbook(request.auth.userId, recipe.id);

      return { recipe };
    });

    app.post('/v1/recipes/import-image', async (request, reply) => {
      const parsed = importImageSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten());
      }
      if (!parsed.data.image.startsWith('data:image/')) {
        return reply.code(400).send({ error: 'Expected a base64 image data URL.' });
      }
      // Groq's 20MB request limit for image inputs -- base64 runs ~33% larger
      // than the source bytes, so this catches an oversized photo before
      // spending an API call on a request that would just get rejected.
      if (parsed.data.image.length > 20 * 1024 * 1024) {
        return reply.code(400).send({ error: 'That image is too large. Try a smaller screenshot.' });
      }

      const extracted = await structureRecipeFromImage(parsed.data.image);
      await db.insert(aiUsage).values({
        userId: request.auth.userId,
        endpoint: '/v1/recipes/import-image',
        model: env.GROQ_VISION_MODEL,
        inputTokens: extracted.usage?.prompt_tokens ?? 0,
        outputTokens: extracted.usage?.completion_tokens ?? 0,
        costEstimateUsd: '0.000000',
      });
      if (!extracted.recipe.recipe_found) {
        return reply
          .code(422)
          .send({ error: "Couldn't find a recipe in that photo -- make sure the ingredients or steps are visible and readable." });
      }

      const candidate = { ...extracted.recipe, source_type: 'image' as const };

      if (!parsed.data.force) {
        const duplicate = await findDuplicateByTitle(request.auth.userId, candidate.title);
        if (duplicate) {
          return { duplicate, candidate };
        }
      }

      const recipe = await createRecipeForUser(request.auth.userId, candidate, wantsLeanVersions(request.query));
      await saveRecipeToCookbook(request.auth.userId, recipe.id);

      return { recipe };
    });

    app.get('/v1/explore', async (request) => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const scored = await db.execute(sql`
        select
          r.id,
          r.title,
          r.cuisine,
          r.total_time_minutes,
          r.difficulty,
          r.short_hook,
          r.dietary_tags,
          r.allergen_warnings,
          v.ingredients,
          v.steps,
          sum(
            case
              when e.event_type = 'save' then 3
              when e.event_type = 'share' then 5
              when e.event_type = 'cook_complete' then 8
              else 0
            end
          ) as score
        from recipes r
        left join recipe_versions v on v.id = r.current_version_id
        left join recipe_events e on e.recipe_id = r.id and e.event_ts >= ${sevenDaysAgo}
        where r.owner_user_id is null or r.owner_user_id = ${request.auth.userId}
        group by r.id, v.ingredients, v.steps
        order by score desc nulls last, r.created_at desc
        limit 30
      `);

      return { items: scored.rows };
    });
  });

  return app;
}
