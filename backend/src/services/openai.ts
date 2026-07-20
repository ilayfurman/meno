import OpenAI from 'openai';
import { env } from '../config/env.js';
import { extractedRecipeSchema, recipeListSchema, recipeSummaryListSchema, type RecipeSummary } from '../types/recipe.js';

// Groq's chat completions endpoint is OpenAI-compatible, so the official
// `openai` SDK works as-is — just repoint baseURL and use a Groq key. Free
// tier, no credit card: console.groq.com.
const client = new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });

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
      model: env.GROQ_MODEL,
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
      model: env.GROQ_MODEL,
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

const extractedRecipeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recipe_found: { type: 'boolean' },
    title: { type: 'string' },
    cuisine: { type: 'string' },
    servings: { type: 'integer' },
    total_time_minutes: { type: 'integer' },
    difficulty: { type: 'string' },
    short_hook: { type: 'string' },
    dietary_tags: { type: 'array', items: { type: 'string' } },
    allergen_warnings: { type: 'array', items: { type: 'string' } },
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
  },
  required: [
    'recipe_found',
    'title',
    'cuisine',
    'servings',
    'total_time_minutes',
    'difficulty',
    'short_hook',
    'dietary_tags',
    'allergen_warnings',
    'ingredients',
    'steps',
  ],
} as const;

// Shared by every extraction entry point (text/URL/PDF/image) -- keeps the
// honesty rules identical everywhere instead of drifting between prompts.
const RECIPE_FOUND_INSTRUCTIONS =
  "Set recipe_found to true only if the source actually contains real recipe content -- at least some real ingredients or preparation steps, not just a title, caption, or unrelated page/app boilerplate. If it does, you may estimate genuinely MINOR missing details (e.g. an unstated serving size or cook time) to fill out the schema, but never invent ingredients or steps that aren't implied by the source. If the source has no real recipe content at all (e.g. a blocked/empty page, a caption with no ingredients or method, an unrelated photo), set recipe_found to false and fill every other field with a minimal placeholder (title: 'No recipe found', cuisine: 'Unknown', servings: 1, total_time_minutes: 1, difficulty: 'unknown', short_hook: '', ingredients: [], steps: []) -- do not fabricate a plausible-looking recipe to fill the gap.";

export async function structureRecipeFromText(rawText: string) {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You extract and structure a recipe from arbitrary user-supplied text (pasted from a messaging app, notes, or a PDF). Return valid JSON only, no markdown. ${RECIPE_FOUND_INSTRUCTIONS}`,
    },
    {
      role: 'user',
      content: `Structure this recipe text into the schema:\n\n${rawText}`,
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
      model: env.GROQ_MODEL,
      messages: payload,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: extraFixPrompt ? 'structured_recipe_fix' : 'structured_recipe',
          strict: true,
          schema: extractedRecipeJsonSchema,
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
    const recipe = extractedRecipeSchema.parse(JSON.parse(first.content));
    return { recipe, usage: first.usage };
  } catch {
    const second = await create(true);
    const recipe = extractedRecipeSchema.parse(JSON.parse(second.content));
    return { recipe, usage: second.usage };
  }
}

// Screenshot import: reads a recipe straight out of an image (a screenshot
// of an Instagram/TikTok caption, a cookbook page photo, a handwritten
// card, etc.) -- the answer to sites like Instagram blocking URL scraping
// entirely, since the user can just paste a screenshot of the same caption
// instead. dataUrl is a base64 `data:image/...;base64,...` string, same
// format the recipe/profile photo pickers already produce.
//
// Uses GROQ_VISION_MODEL (not GROQ_MODEL) since the default text model has
// no vision support. That model isn't on Groq's guaranteed-strict-
// json_schema list, so this uses plain JSON mode + the same
// parse-then-retry-with-a-fix-prompt shape as structureRecipeFromText
// rather than the `response_format: json_schema` used there.
export async function structureRecipeFromImage(dataUrl: string) {
  const schemaDescription =
    '{"recipe_found": boolean, "title": string, "cuisine": string, "servings": integer, "total_time_minutes": integer, "difficulty": string, "short_hook": string, "dietary_tags": string[], "allergen_warnings": string[], "ingredients": [{"name": string, "quantity": string, "unit": string, "notes": string|null, "quantity_value": number|null, "quantity_unit": string|null, "quantity_text": string|null}], "steps": [{"idx": integer, "text": string, "timer_seconds": integer|null}]}';

  const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You extract and structure a recipe from a photo -- a screenshot of a social media caption or comment, a cookbook page, a handwritten recipe card, or similar. Return valid JSON only, no markdown, matching exactly this shape: ${schemaDescription}. ${RECIPE_FOUND_INSTRUCTIONS}`,
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Extract the recipe from this image and structure it into the schema described above. Return JSON only.' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];

  const create = async (extraFixPrompt?: boolean) => {
    const payload = extraFixPrompt
      ? [
          ...baseMessages,
          {
            role: 'user' as const,
            content: 'Fix JSON: output strictly valid JSON only, matching the schema exactly, no markdown formatting.',
          },
        ]
      : baseMessages;

    const response = await client.chat.completions.create({
      model: env.GROQ_VISION_MODEL,
      messages: payload,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI response was empty.');
    }

    return { content, usage: response.usage };
  };

  const first = await create(false);
  try {
    const recipe = extractedRecipeSchema.parse(JSON.parse(first.content));
    return { recipe, usage: first.usage };
  } catch {
    const second = await create(true);
    const recipe = extractedRecipeSchema.parse(JSON.parse(second.content));
    return { recipe, usage: second.usage };
  }
}

export async function askAgent(question: string, recipes: unknown[]) {
  const response = await client.chat.completions.create({
    model: env.GROQ_MODEL,
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
