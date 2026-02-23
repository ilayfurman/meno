import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authGuard } from './plugins/auth.js';
import { db } from './db/client.js';
import { aiUsage, cookbookItems, generationRequests, recipeEvents, recipes } from './db/schema.js';
import {
  agentRequestSchema,
  cookbookReorderSchema,
  cookbookSaveSchema,
  eventCreateSchema,
  generationRequestSchema,
  hydrationRequestSchema,
  importUrlSchema,
  recipeSummaryListSchema,
  type Recipe,
} from './types/recipe.js';
import { askAgent, generateRecipeSummariesWithAi, generateRecipesWithAi, hydrateRecipeFromSummaryWithAi } from './services/openai.js';
import {
  createRecipeForUser,
  ensureRecipeAndSaveToCookbook,
  getRecipeByIdForUser,
  listCookbook,
  removeFromCookbook,
  reorderCookbook,
} from './services/recipes.js';
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
        model: env.OPENAI_MODEL,
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
        model: env.OPENAI_MODEL,
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
        model: env.OPENAI_MODEL,
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

    return reply.send(buildRecipePayload(recipe));
  });

  app.get('/v1/cookbook', async (request) => {
    const list = await listCookbook(request.auth.userId);
    return {
      recipes: list.map(buildRecipePayload),
    };
  });

  app.post('/v1/cookbook/items', async (request, reply) => {
    const parsed = cookbookSaveSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error.flatten());
    }

    const saved = await ensureRecipeAndSaveToCookbook(request.auth.userId, parsed.data.recipe);
    return { saved };
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
      model: env.OPENAI_MODEL,
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
    const created = await createRecipeForUser(request.auth.userId, {
      ...imported,
      id: undefined,
      completion_state: 'full',
      sourceType: 'imported',
      sourceUrl: imported.source_url,
      sourceDomain: imported.source_domain,
    });

    await ensureRecipeAndSaveToCookbook(request.auth.userId, created);

    return { recipe: buildRecipePayload(created) };
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
        r.ingredients,
        r.steps,
        r.substitutions,
        sum(
          case
            when e.event_type = 'save' then 3
            when e.event_type = 'share' then 5
            when e.event_type = 'cook_complete' then 8
            else 0
          end
        ) as score
      from recipes r
      left join recipe_events e on e.recipe_id = r.id and e.event_ts >= ${sevenDaysAgo}
      where r.owner_user_id is null or r.owner_user_id = ${request.auth.userId}
      group by r.id
      order by score desc nulls last, r.created_at desc
      limit 30
    `);

    return { items: scored.rows };
  });

  return app;
}
