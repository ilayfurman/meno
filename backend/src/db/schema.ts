import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email'),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
});

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
    ingredients: jsonb('ingredients').notNull(),
    steps: jsonb('steps').notNull(),
    substitutions: jsonb('substitutions').notNull(),
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

export const cookbookItems = pgTable(
  'cookbook_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
    isArchived: boolean('is_archived').notNull().default(false),
  },
  (table) => ({
    userOrderIdx: index('cookbook_items_user_order_idx').on(table.userId, table.orderIndex),
    userRecipeUnique: unique('cookbook_items_user_recipe_unique').on(table.userId, table.recipeId),
  }),
);

export const generationRequests = pgTable(
  'generation_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull(),
    requestHash: text('request_hash'),
    status: varchar('status', { length: 16 }).notNull(),
    responseJson: jsonb('response_json'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    userCreatedIdx: index('generation_requests_user_created_idx').on(table.userId, table.createdAt),
    userIdempotencyUnique: unique('generation_requests_user_idempotency_unique').on(
      table.userId,
      table.idempotencyKey,
    ),
  }),
);

export const recipeEvents = pgTable(
  'recipe_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    eventTs: timestamp('event_ts', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    userTypeTimeIdx: index('recipe_events_user_type_ts_idx').on(table.userId, table.eventType, table.eventTs),
  }),
);

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costEstimateUsd: numeric('cost_estimate_usd', { precision: 10, scale: 6 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index('ai_usage_user_created_idx').on(table.userId, table.createdAt),
    endpointCreatedIdx: index('ai_usage_endpoint_created_idx').on(table.endpoint, table.createdAt),
  }),
);
