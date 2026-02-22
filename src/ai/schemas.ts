import { z } from 'zod';

export const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  unit: z.string(),
  notes: z.string().nullish(),
  quantity_value: z.number().nullish(),
  quantity_unit: z.string().nullish(),
  quantity_text: z.string().nullish(),
});

export const stepSchema = z.object({
  idx: z.number().int().min(1),
  text: z.string(),
  timer_seconds: z.number().int().positive().nullish(),
});

export const substitutionSchema = z.object({
  ingredient: z.string(),
  substitutes: z.array(z.string()),
  notes: z.string(),
});

export const recipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  cuisine: z.string(),
  servings: z.number().int().min(1),
  total_time_minutes: z.number().int().min(1),
  difficulty: z.string(),
  short_hook: z.string(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  substitutions: z.array(substitutionSchema),
  dietary_tags: z.array(z.string()),
  allergen_warnings: z.array(z.string()),
  completion_state: z.enum(['summary', 'full']).optional(),
});

export const recipeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  cuisine: z.string(),
  servings_hint: z.number().int().min(1).optional(),
  total_time_minutes: z.number().int().min(1),
  difficulty: z.string(),
  short_hook: z.string(),
  dietary_tags: z.array(z.string()),
  allergen_warnings: z.array(z.string()),
});

export const recipeSummaryListSchema = z.object({
  recipes: z.array(recipeSummarySchema).min(1),
});

export const recipeListSchema = z.object({
  recipes: z.array(recipeSchema).min(1),
});

export type RecipeListResponse = z.infer<typeof recipeListSchema>;

export const recipeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recipes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          cuisine: { type: 'string' },
          servings: { type: 'integer' },
          total_time_minutes: { type: 'integer' },
          difficulty: { type: 'string' },
          short_hook: { type: 'string' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                quantity: { type: 'string' },
                unit: { type: 'string' },
                notes: { type: ['string', 'null'] },
                quantity_value: { type: ['number', 'null'] },
                quantity_unit: { type: ['string', 'null'] },
                quantity_text: { type: ['string', 'null'] },
              },
              required: ['name', 'quantity', 'unit', 'notes', 'quantity_value', 'quantity_unit', 'quantity_text'],
            },
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                idx: { type: 'integer' },
                text: { type: 'string' },
                timer_seconds: { type: ['integer', 'null'] },
              },
              required: ['idx', 'text', 'timer_seconds'],
            },
          },
          substitutions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ingredient: { type: 'string' },
                substitutes: {
                  type: 'array',
                  items: { type: 'string' },
                },
                notes: { type: 'string' },
              },
              required: ['ingredient', 'substitutes', 'notes'],
            },
          },
          dietary_tags: {
            type: 'array',
            items: { type: 'string' },
          },
          allergen_warnings: {
            type: 'array',
            items: { type: 'string' },
          },
          completion_state: { type: 'string', enum: ['summary', 'full'] },
        },
        required: [
          'id',
          'title',
          'cuisine',
          'servings',
          'total_time_minutes',
          'difficulty',
          'short_hook',
          'ingredients',
          'steps',
          'substitutions',
          'dietary_tags',
          'allergen_warnings',
          'completion_state',
        ],
      },
    },
  },
  required: ['recipes'],
};

export const recipeSummaryJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recipes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          cuisine: { type: 'string' },
          servings_hint: { type: 'integer' },
          total_time_minutes: { type: 'integer' },
          difficulty: { type: 'string' },
          short_hook: { type: 'string' },
          dietary_tags: {
            type: 'array',
            items: { type: 'string' },
          },
          allergen_warnings: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: [
          'id',
          'title',
          'cuisine',
          'total_time_minutes',
          'difficulty',
          'short_hook',
          'dietary_tags',
          'allergen_warnings',
        ],
      },
    },
  },
  required: ['recipes'],
};
