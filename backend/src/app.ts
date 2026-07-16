import Fastify from 'fastify';
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
  cookbookReorderSchema,
  createRecipeSchema,
  eventCreateSchema,
  generationRequestSchema,
  hydrationRequestSchema,
  importTextSchema,
  importUrlSchema,
  recipeSummaryListSchema,
  updateVideoLinkSchema,
  type Recipe,
} from './types/recipe.js';
import {
  askAgent,
  generateRecipeSummariesWithAi,
  generateRecipesWithAi,
  hydrateRecipeFromSummaryWithAi,
  structureRecipeFromText,
} from './services/openai.js';
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
import { getPlan, getPreferences, updatePreferences } from './services/preferences.js';
import { allowedImportDomains, env } from './config/env.js';
import { importRecipeFromUrl } from './services/importer.js';

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

export function createApp() {
  const app = Fastify({ logger: true });

  void app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  void app.register(sensible);
  void app.register(multipart, {
    limits: { fileSize: env.MAX_IMPORT_RESPONSE_BYTES },
  });

  app.get('/health', async () => ({ ok: true }));

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
    const params = z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).safeParse(request.params);
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

  app.post('/v1/recipes/import-text', async (request, reply) => {
    const parsed = importTextSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    const extracted = await structureRecipeFromText(parsed.data.text);
    const recipe = await createRecipeForUser(request.auth.userId, {
      ...extracted.recipe,
      source_type: 'text',
    });
    await saveRecipeToCookbook(request.auth.userId, recipe.id);

    await db.insert(aiUsage).values({
      userId: request.auth.userId,
      endpoint: '/v1/recipes/import-text',
      model: env.GROQ_MODEL,
      inputTokens: extracted.usage?.prompt_tokens ?? 0,
      outputTokens: extracted.usage?.completion_tokens ?? 0,
      costEstimateUsd: '0.000000',
    });

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

    const extracted = await structureRecipeFromText(text);
    const recipe = await createRecipeForUser(request.auth.userId, {
      ...extracted.recipe,
      source_type: 'pdf',
    });
    await saveRecipeToCookbook(request.auth.userId, recipe.id);

    await db.insert(aiUsage).values({
      userId: request.auth.userId,
      endpoint: '/v1/recipes/import-pdf',
      model: env.GROQ_MODEL,
      inputTokens: extracted.usage?.prompt_tokens ?? 0,
      outputTokens: extracted.usage?.completion_tokens ?? 0,
      costEstimateUsd: '0.000000',
    });

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

  return app;
}
