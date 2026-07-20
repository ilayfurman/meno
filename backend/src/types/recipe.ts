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

export const recipeVersionSchema = z.object({
  id: z.string().uuid().optional(),
  version_number: z.number().int().min(1),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  change_note: z.string().nullable(),
  created_at: z.string().nullable().optional(),
});

export const recipeLinkSchema = z.object({
  url: z.string().url(),
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'other']),
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
  links: z.array(recipeLinkSchema),
  // Plain string rather than z.string().url() -- this is usually a data:
  // URL (base64-encoded photo the user picked from their library), which
  // can be a few hundred KB of text and doesn't need URL-shape validation.
  image_url: z.string().nullable(),
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
  links: z.array(z.object({ url: z.string().url() })).optional(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  change_note: z.string().nullable().optional(),
  source_type: z.enum(['generated', 'link', 'pdf', 'text', 'image']).default('generated'),
  source_url: z.string().url().nullable().optional(),
});

export const addRecipeVersionSchema = z.object({
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  change_note: z.string().nullable().optional(),
  set_as_current: z.boolean().default(true),
});

// Same shape as addRecipeVersionSchema minus set_as_current -- updating a
// version in place doesn't touch which version is current, since it's not
// creating a new one.
export const updateRecipeVersionSchema = z.object({
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  change_note: z.string().nullable().optional(),
});

// Full-replacement update -- the caller sends the whole current list of
// links (after adding/editing/removing one in the UI), not a single delta.
// Keeps this to one endpoint instead of separate add/edit/remove routes.
export const updateRecipeLinksSchema = z.object({
  links: z.array(z.object({ url: z.string().url() })),
});

export const updateRecipePhotoSchema = z.object({
  image_url: z.string().nullable(),
});

export const extractedRecipeSchema = z.object({
  // The model's own honest signal that the source (page text or image) it
  // was given actually contained real recipe content. False means the
  // fields below are meaningless placeholders, not a usable recipe --
  // callers must check this before saving anything. Added after the app
  // fabricated a full pasta recipe from an Instagram link whose page
  // couldn't actually be read (Instagram blocks scrapers), because the old
  // prompt told the model to "make a reasonable estimate" for anything
  // missing with no escape hatch for "nothing is here at all."
  recipe_found: z.boolean(),
  title: z.string(),
  cuisine: z.string(),
  servings: z.number().int().min(1),
  total_time_minutes: z.number().int().min(1),
  difficulty: z.string(),
  short_hook: z.string(),
  dietary_tags: z.array(z.string()),
  allergen_warnings: z.array(z.string()),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
});

export const importTextSchema = z.object({
  text: z.string().min(1),
  force: z.boolean().default(false),
});

export const importImageSchema = z.object({
  // A data: URL (base64), same format used everywhere else images are sent
  // in this app (recipe photo, profile photo).
  image: z.string().min(1),
  force: z.boolean().default(false),
});

export const duplicateCandidateSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  cuisine: z.string(),
  total_time_minutes: z.number().int().min(1),
});

export type StoredRecipe = z.infer<typeof storedRecipeSchema>;
export type RecipeVersion = z.infer<typeof recipeVersionSchema>;
export type ExtractedRecipe = z.infer<typeof extractedRecipeSchema>;

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
  force: z.boolean().default(false),
});

export type Recipe = z.infer<typeof recipeSchema>;
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;
