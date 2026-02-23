import OpenAI from 'openai';
import { env } from '../config/env.js';
import { recipeListSchema, recipeSummaryListSchema, type RecipeSummary } from '../types/recipe.js';

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const recipeJsonSchema = {
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
                substitutes: { type: 'array', items: { type: 'string' } },
                notes: { type: 'string' },
              },
              required: ['ingredient', 'substitutes', 'notes'],
            },
          },
          dietary_tags: { type: 'array', items: { type: 'string' } },
          allergen_warnings: { type: 'array', items: { type: 'string' } },
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
} as const;

const recipeSummaryJsonSchema = {
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
          servings_hint: { type: ['integer', 'null'] },
          total_time_minutes: { type: 'integer' },
          difficulty: { type: 'string' },
          short_hook: { type: 'string' },
          dietary_tags: { type: 'array', items: { type: 'string' } },
          allergen_warnings: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'id',
          'title',
          'cuisine',
          'servings_hint',
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
} as const;

function generationPrompt(params: {
  count: number;
  request: { time: number; vibe: string; difficulty: string };
  preferences: {
    dietaryRestriction: string;
    allergies: string[];
    cuisinesLiked: string[];
    spiceLevel: string;
  };
  swapInstruction?: string;
  baseRecipe?: unknown;
}) {
  const { count, request, preferences } = params;
  const swapBlock = params.swapInstruction
    ? `\nAdjustment request: ${params.swapInstruction}\nBase recipe to transform and improve: ${JSON.stringify(params.baseRecipe)}`
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
    'Set completion_state to "full".',
    'Output numeric ingredient quantities when possible via quantity_value and quantity_unit.',
    'For non-numeric items, set quantity_value to null and populate quantity_text.',
    swapBlock,
  ].join('\n');
}

function summaryPrompt(params: {
  count: number;
  request: { time: number; vibe: string; difficulty: string };
  preferences: {
    dietaryRestriction: string;
    allergies: string[];
    cuisinesLiked: string[];
    spiceLevel: string;
  };
}) {
  const { count, request, preferences } = params;
  return [
    `Create ${count} dinner idea summaries.`,
    `Time target: ${request.time} minutes max.`,
    `Vibe: ${request.vibe}.`,
    `Difficulty: ${request.difficulty}.`,
    `Dietary restriction: ${preferences.dietaryRestriction}.`,
    `Allergies to avoid: ${preferences.allergies.join(', ') || 'none'}.`,
    `Preferred cuisines: ${preferences.cuisinesLiked.join(', ') || 'any'}.`,
    `Spice level: ${preferences.spiceLevel}.`,
    'Return summary cards only (no ingredients, no steps).',
  ].join('\n');
}

export async function generateRecipesWithAi(params: {
  count: number;
  request: { time: number; vibe: string; difficulty: string };
  preferences: {
    dietaryRestriction: string;
    allergies: string[];
    cuisinesLiked: string[];
    spiceLevel: string;
  };
  swapInstruction?: string;
  baseRecipe?: unknown;
}) {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'You are a strict recipe generator. Return valid JSON only. No markdown.',
    },
    {
      role: 'user',
      content: generationPrompt(params),
    },
  ];

  const create = async (extraFixPrompt?: boolean) => {
    const payload = extraFixPrompt
      ? [
          ...messages,
          {
            role: 'user' as const,
            content: 'Fix JSON: output strictly valid schema-compliant JSON only.',
          },
        ]
      : messages;

    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: payload,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: extraFixPrompt ? 'recipe_response_fix' : 'recipe_response',
          strict: true,
          schema: recipeJsonSchema,
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI response was empty.');
    }

    return { content, usage: response.usage };
  };

  const first = await create(false);
  try {
    const parsed = recipeListSchema.parse(JSON.parse(first.content));
    return { recipes: parsed.recipes, usage: first.usage };
  } catch {
    const second = await create(true);
    const parsed = recipeListSchema.parse(JSON.parse(second.content));
    return { recipes: parsed.recipes, usage: second.usage };
  }
}

export async function generateRecipeSummariesWithAi(params: {
  count: number;
  request: { time: number; vibe: string; difficulty: string };
  preferences: {
    dietaryRestriction: string;
    allergies: string[];
    cuisinesLiked: string[];
    spiceLevel: string;
  };
}) {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'You are a strict recipe ideation generator. Return valid JSON only. No markdown.',
    },
    {
      role: 'user',
      content: summaryPrompt(params),
    },
  ];

  const create = async (extraFixPrompt?: boolean) => {
    const payload = extraFixPrompt
      ? [
          ...messages,
          {
            role: 'user' as const,
            content: 'Fix JSON: output strictly valid schema-compliant JSON only.',
          },
        ]
      : messages;

    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: payload,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: extraFixPrompt ? 'recipe_summaries_fix' : 'recipe_summaries',
          strict: true,
          schema: recipeSummaryJsonSchema,
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI response was empty.');
    }

    return { content, usage: response.usage };
  };

  const first = await create(false);
  try {
    const parsed = recipeSummaryListSchema.parse(JSON.parse(first.content));
    return { recipes: parsed.recipes, usage: first.usage };
  } catch {
    const second = await create(true);
    const parsed = recipeSummaryListSchema.parse(JSON.parse(second.content));
    return { recipes: parsed.recipes, usage: second.usage };
  }
}

export async function hydrateRecipeFromSummaryWithAi(params: {
  request: { time: number; vibe: string; difficulty: string };
  preferences: {
    dietaryRestriction: string;
    allergies: string[];
    cuisinesLiked: string[];
    spiceLevel: string;
  };
  summary: RecipeSummary;
  swapInstruction?: string;
  baseRecipe?: unknown;
}) {
  return generateRecipesWithAi({
    count: 1,
    request: params.request,
    preferences: params.preferences,
    swapInstruction: params.swapInstruction,
    baseRecipe: params.baseRecipe ?? params.summary,
  });
}

export async function askAgent(question: string, recipes: unknown[]) {
  const response = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are Meno assistant. Answer cookbook questions clearly and concisely with practical cooking guidance.',
      },
      {
        role: 'user',
        content: `Question: ${question}\nRecipes context: ${JSON.stringify(recipes)}`,
      },
    ],
  });

  return {
    text: response.choices[0]?.message?.content ?? 'No answer returned.',
    usage: response.usage,
  };
}
