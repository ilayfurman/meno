import { z } from 'zod';

export const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  unit: z.string(),
  notes: z.string().nullable(),
  quantity_value: z.number().nullable(),
  quantity_unit: z.string().nullable(),
  quantity_text: z.string().nullable(),
});

export const stepSchema = z.object({
  idx: z.number().int().min(1),
  text: z.string(),
  timer_seconds: z.number().int().positive().nullable(),
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
  completion_state: z.enum(['summary', 'full']).default('full'),
});

export const recipeListSchema = z.object({
  recipes: z.array(recipeSchema).min(1),
});

export const recipeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  cuisine: z.string(),
  servings_hint: z.number().int().min(1).nullable(),
  total_time_minutes: z.number().int().min(1),
  difficulty: z.string(),
  short_hook: z.string(),
  dietary_tags: z.array(z.string()),
  allergen_warnings: z.array(z.string()),
});

export const recipeSummaryListSchema = z.object({
  recipes: z.array(recipeSummarySchema).min(1),
});

export const generationRequestSchema = z.object({
  request: z.object({
    time: z.number().int().positive(),
    vibe: z.string(),
    difficulty: z.string(),
  }),
  preferences: z.object({
    dietaryRestriction: z.string(),
    allergies: z.array(z.string()),
    cuisinesLiked: z.array(z.string()),
    spiceLevel: z.string(),
  }),
  count: z.number().int().min(1).max(6).default(3),
  swapInstruction: z.string().optional(),
  baseRecipe: recipeSchema.optional(),
});

export const hydrationRequestSchema = z.object({
  request: generationRequestSchema.shape.request,
  preferences: generationRequestSchema.shape.preferences,
  summary: recipeSummarySchema,
  swapInstruction: z.string().optional(),
  baseRecipe: recipeSchema.optional(),
});

export const agentRequestSchema = z.object({
  question: z.string().min(1),
  recipes: z.array(recipeSchema).max(20),
});

export const cookbookReorderSchema = z.object({
  recipeIds: z.array(z.string().uuid()).min(1),
});

export const cookbookSaveSchema = z.object({
  recipe: recipeSchema,
});

export const eventCreateSchema = z.object({
  eventType: z.string().min(1),
  recipeId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const importUrlSchema = z.object({
  url: z.string().url(),
});

export type Recipe = z.infer<typeof recipeSchema>;
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;
