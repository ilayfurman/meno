import {
  recipeJsonSchema,
  recipeListSchema,
  recipeSummaryJsonSchema,
  recipeSummaryListSchema,
} from './schemas';
import type { GenerationRequest, Recipe, RecipeSummary, UserPreferences } from '../types';

const OPENAI_API_KEY = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  ?.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5.2';

interface GenerateRecipesParams {
  preferences: UserPreferences;
  request: GenerationRequest;
  count: number;
  swapInstruction?: string;
  baseRecipe?: Recipe;
}

interface GenerateSummaryParams {
  preferences: UserPreferences;
  request: GenerationRequest;
  count: number;
}

interface GenerateFullRecipeParams {
  preferences: UserPreferences;
  request: GenerationRequest;
  summary: RecipeSummary;
  swapInstruction?: string;
  baseRecipe?: Recipe;
}

function buildPrompt(params: GenerateRecipesParams): string {
  const { preferences, request, count, swapInstruction, baseRecipe } = params;

  const swapBlock = swapInstruction
    ? `\nAdjustment request: ${swapInstruction}\nBase recipe to transform and improve: ${JSON.stringify(baseRecipe)}`
    : '';

  return [
    `Create ${count} dinner recipe option(s).`,
    `Time target: ${request.time} minutes max.`,
    `Vibe: ${request.vibe}.`,
    `Difficulty: ${request.difficulty}.`,
    `Dietary restriction: ${preferences.dietaryRestriction}.`,
    `Allergies to avoid: ${preferences.allergies.join(', ') || 'none'}.`,
    `Preferred cuisines: ${preferences.cuisinesLiked.join(', ') || 'any'}.`,
    `Spice level: ${preferences.spiceLevel}.`,
    'Return practical weeknight dinners with coherent quantities and steps.',
    'Set completion_state to "full".',
    'Output numeric ingredient quantities when possible via quantity_value and quantity_unit.',
    'For non-numeric items, set quantity_value to null and populate quantity_text.',
    'If allergens conflict with substitutions, mention warnings clearly.',
    swapBlock,
  ].join('\n');
}

async function requestStructured(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  schemaName: string,
  schema: Record<string, unknown>,
) {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY in environment.');
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
  }

  const body = await response.json();
  const raw = body.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('OpenAI response was empty.');
  }

  return raw as string;
}

async function requestText(messages: Array<{ role: 'system' | 'user'; content: string }>) {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY in environment.');
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
  }

  const body = await response.json();
  const raw = body.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('OpenAI response was empty.');
  }
  return raw as string;
}

function normalizeRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    completion_state: 'full',
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: ingredient.quantity ?? ingredient.quantity_text ?? '',
      unit: ingredient.unit ?? ingredient.quantity_unit ?? '',
      quantity_value: ingredient.quantity_value ?? null,
      quantity_unit: ingredient.quantity_unit ?? ingredient.unit ?? null,
      quantity_text: ingredient.quantity_text ?? ingredient.quantity ?? null,
    })),
  };
}

export async function generateRecipeSummaries(params: GenerateSummaryParams): Promise<RecipeSummary[]> {
  const userPrompt = [
    `Create ${params.count} dinner idea summaries.`,
    `Time target: ${params.request.time} minutes max.`,
    `Vibe: ${params.request.vibe}.`,
    `Difficulty: ${params.request.difficulty}.`,
    `Dietary restriction: ${params.preferences.dietaryRestriction}.`,
    `Allergies to avoid: ${params.preferences.allergies.join(', ') || 'none'}.`,
    `Preferred cuisines: ${params.preferences.cuisinesLiked.join(', ') || 'any'}.`,
    `Spice level: ${params.preferences.spiceLevel}.`,
    'Return summary cards only (no ingredients, no steps).',
  ].join('\n');

  const baseMessages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content: 'You are a strict recipe ideation generator. Return only valid JSON matching schema. No markdown.',
    },
    { role: 'user', content: userPrompt },
  ];

  const firstRaw = await requestStructured(baseMessages, 'recipe_summaries', recipeSummaryJsonSchema);

  try {
    return recipeSummaryListSchema.parse(JSON.parse(firstRaw)).recipes;
  } catch {
    const secondRaw = await requestStructured(
      [
        ...baseMessages,
        {
          role: 'user',
          content: 'Fix JSON: output strictly valid schema-compliant JSON only.',
        },
      ],
      'recipe_summaries_fix',
      recipeSummaryJsonSchema,
    );
    return recipeSummaryListSchema.parse(JSON.parse(secondRaw)).recipes;
  }
}

export async function generateFullRecipeFromSummary(params: GenerateFullRecipeParams): Promise<Recipe> {
  const swapBlock = params.swapInstruction
    ? `\nAdjustment request: ${params.swapInstruction}\nBase recipe to transform and improve: ${JSON.stringify(params.baseRecipe)}`
    : '';

  const userPrompt = [
    'Generate exactly 1 full recipe from this summary idea.',
    `Summary: ${JSON.stringify(params.summary)}`,
    `Time target: ${params.request.time} minutes max.`,
    `Vibe: ${params.request.vibe}.`,
    `Difficulty: ${params.request.difficulty}.`,
    `Dietary restriction: ${params.preferences.dietaryRestriction}.`,
    `Allergies to avoid: ${params.preferences.allergies.join(', ') || 'none'}.`,
    `Preferred cuisines: ${params.preferences.cuisinesLiked.join(', ') || 'any'}.`,
    `Spice level: ${params.preferences.spiceLevel}.`,
    'Output numeric ingredient quantities when possible via quantity_value and quantity_unit.',
    'For non-numeric items like "to taste", set quantity_value to null and fill quantity_text.',
    'Set completion_state to "full".',
    swapBlock,
  ].join('\n');

  const baseMessages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        'You are a strict recipe generator. Return only valid JSON matching schema. No markdown. No prose.',
    },
    { role: 'user', content: userPrompt },
  ];

  const firstRaw = await requestStructured(baseMessages, 'recipe_full', recipeJsonSchema);
  try {
    const parsed = recipeListSchema.parse(JSON.parse(firstRaw)).recipes[0];
    return normalizeRecipe(parsed);
  } catch {
    const secondRaw = await requestStructured(
      [
        ...baseMessages,
        {
          role: 'user',
          content: 'Fix JSON: output strictly valid schema-compliant JSON only.',
        },
      ],
      'recipe_full_fix',
      recipeJsonSchema,
    );
    const parsed = recipeListSchema.parse(JSON.parse(secondRaw)).recipes[0];
    return normalizeRecipe(parsed);
  }
}

export async function generateRecipes(params: GenerateRecipesParams): Promise<Recipe[]> {
  const userPrompt = buildPrompt(params);
  const baseMessages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content:
        'You are a strict recipe generator. Return only valid JSON matching the schema. No markdown. No prose.',
    },
    { role: 'user', content: userPrompt },
  ];

  const firstRaw = await requestStructured(baseMessages, 'recipe_response', recipeJsonSchema);
  try {
    return recipeListSchema.parse(JSON.parse(firstRaw)).recipes.map(normalizeRecipe);
  } catch {
    const secondRaw = await requestStructured(
      [
        ...baseMessages,
        {
          role: 'user',
          content:
            'Fix JSON: return the same answer but strictly valid JSON matching schema. Output only JSON.',
        },
      ],
      'recipe_response_fix',
      recipeJsonSchema,
    );
    return recipeListSchema.parse(JSON.parse(secondRaw)).recipes.map(normalizeRecipe);
  }
}

export async function askAboutRecipes(question: string, recipes: Recipe[]): Promise<string> {
  if (!question.trim()) {
    throw new Error('Question is required.');
  }
  if (!recipes.length) {
    throw new Error('Select at least one recipe.');
  }

  const recipeSummary = recipes.map((recipe) => ({
    title: recipe.title,
    cuisine: recipe.cuisine,
    time: recipe.total_time_minutes,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    dietary_tags: recipe.dietary_tags,
    allergen_warnings: recipe.allergen_warnings,
    ingredients: recipe.ingredients.map((ing) => ing.name),
    short_hook: recipe.short_hook,
  }));

  return requestText([
    {
      role: 'system',
      content:
        'You are Meno assistant. Answer cookbook questions clearly and concisely with practical cooking guidance.',
    },
    {
      role: 'user',
      content: `Question: ${question}\n\nSelected recipes:\n${JSON.stringify(recipeSummary)}`,
    },
  ]);
}
