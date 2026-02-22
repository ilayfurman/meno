import { recipeJsonSchema, recipeListSchema } from './schemas';
import type { GenerationRequest, Recipe, UserPreferences } from '../types';

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

function buildPrompt(params: GenerateRecipesParams): string {
  const { preferences, request, count, swapInstruction, baseRecipe } = params;

  const swapBlock = swapInstruction
    ? `\nSwap request: ${swapInstruction}\nBase recipe to transform: ${JSON.stringify(baseRecipe)}`
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
    'If allergens conflict with substitutions, mention warnings clearly.',
    swapBlock,
  ].join('\n');
}

async function requestRecipes(messages: Array<{ role: 'system' | 'user'; content: string }>) {
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
          name: 'recipe_response',
          strict: true,
          schema: recipeJsonSchema,
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

  const firstRaw = await requestRecipes(baseMessages);

  try {
    return recipeListSchema.parse(JSON.parse(firstRaw)).recipes;
  } catch {
    const secondRaw = await requestRecipes([
      ...baseMessages,
      {
        role: 'user',
        content:
          'Fix JSON: return the same answer but strictly valid JSON matching schema. Output only JSON.',
      },
    ]);
    return recipeListSchema.parse(JSON.parse(secondRaw)).recipes;
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
