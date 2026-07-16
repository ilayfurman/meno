import { env } from '../config/env.js';
import { assertSafeTarget, isHttpProtocol } from '../utils/ssrf.js';

interface ImportResult {
  title: string;
  cuisine: string;
  servings: number;
  total_time_minutes: number;
  difficulty: string;
  short_hook: string;
  ingredients: Array<{
    name: string;
    quantity: string;
    unit: string;
    notes: string | null;
    quantity_value: number | null;
    quantity_unit: string | null;
    quantity_text: string | null;
  }>;
  steps: Array<{ idx: number; text: string; timer_seconds: number | null }>;
  substitutions: Array<{ ingredient: string; substitutes: string[]; notes: string }>;
  dietary_tags: string[];
  allergen_warnings: string[];
  source_url: string;
  source_domain: string;
}

function normalizeText(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function parseJsonLd(html: string): unknown[] {
  const matches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const blocks: unknown[] = [];

  for (const scriptTag of matches) {
    const contentMatch = scriptTag.match(/>([\s\S]*?)<\/script>/i);
    if (!contentMatch?.[1]) continue;

    try {
      const parsed = JSON.parse(contentMatch[1]);
      blocks.push(parsed);
    } catch {
      // ignore invalid blocks
    }
  }

  return blocks;
}

function findRecipeNode(nodes: unknown[]): Record<string, unknown> | null {
  for (const node of nodes) {
    if (Array.isArray(node)) {
      const nested = findRecipeNode(node);
      if (nested) return nested;
      continue;
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      if (record['@type'] === 'Recipe') {
        return record;
      }
      if (Array.isArray(record['@graph'])) {
        const nested = findRecipeNode(record['@graph']);
        if (nested) return nested;
      }
    }
  }
  return null;
}

export interface FetchedPage {
  html: string;
  hostname: string;
  url: string;
}

// Fetches and safety-checks the page only -- no extraction. Shared by both
// the free JSON-LD path and the AI-extraction fallback below, so the
// SSRF/size/content-type guards only live in one place.
export async function fetchRecipePage(url: string, allowedDomains: string[]): Promise<FetchedPage> {
  const parsed = new URL(url);
  if (!isHttpProtocol(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (allowedDomains.length > 0 && !allowedDomains.includes(hostname)) {
    throw new Error('Domain is not allowlisted yet.');
  }

  await assertSafeTarget(hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);
  const response = await fetch(parsed.toString(), {
    method: 'GET',
    redirect: 'follow',
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status}).`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    throw new Error('Only HTML recipe pages are supported.');
  }

  const contentLength = Number(response.headers.get('content-length') ?? '0');
  if (contentLength > env.MAX_IMPORT_RESPONSE_BYTES) {
    throw new Error('Response exceeded allowed size.');
  }

  const html = await response.text();
  if (html.length > env.MAX_IMPORT_RESPONSE_BYTES) {
    throw new Error('Response exceeded allowed size.');
  }

  return { html, hostname, url: parsed.toString() };
}

// Strips a page down to plain, readable text so it's cheap to hand to the
// LLM -- drops script/style/nav/header/footer blocks (boilerplate that
// wastes tokens and can confuse extraction), then collapses tags and
// whitespace. Capped well under Groq's context window to keep cost and
// latency predictable per import.
const SKIPPED_TAGS = /<(script|style|nav|header|footer|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi;
const MAX_EXTRACT_CHARS = 14000;

export function htmlToReadableText(html: string): string {
  const withoutBoilerplate = html.replace(SKIPPED_TAGS, ' ');
  const withoutTags = withoutBoilerplate.replace(/<[^>]+>/g, ' ');
  const decoded = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const collapsed = decoded.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, MAX_EXTRACT_CHARS);
}

// Zero-AI-cost path: only works when the page has schema.org Recipe JSON-LD
// markup (most established recipe sites do). Returns null instead of
// throwing so callers can fall back to AI extraction on pages that don't.
export function extractRecipeFromJsonLd(page: FetchedPage): ImportResult | null {
  const { html, hostname, url } = page;
  const jsonLdNodes = parseJsonLd(html);
  const recipeNode = findRecipeNode(jsonLdNodes);
  if (!recipeNode) {
    return null;
  }

  const ingredientNames = Array.isArray(recipeNode.recipeIngredient)
    ? recipeNode.recipeIngredient.map((item) => normalizeText(item, 'Ingredient')).filter(Boolean)
    : [];

  const instructionsRaw = recipeNode.recipeInstructions;
  const instructionList: string[] = Array.isArray(instructionsRaw)
    ? instructionsRaw.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).text === 'string') {
          return (item as Record<string, unknown>).text as string;
        }
        return '';
      })
    : typeof instructionsRaw === 'string'
      ? [instructionsRaw]
      : [];

  return {
    title: normalizeText(recipeNode.name, 'Imported Recipe'),
    cuisine: normalizeText(recipeNode.recipeCuisine, 'International'),
    servings: Number(recipeNode.recipeYield) || 4,
    total_time_minutes: 30,
    difficulty: 'medium',
    short_hook: 'Imported from URL and normalized for Meno.',
    ingredients: ingredientNames.map((name) => ({
      name,
      quantity: '',
      unit: '',
      notes: null,
      quantity_value: null,
      quantity_unit: null,
      quantity_text: null,
    })),
    steps: instructionList.map((text, index) => ({ idx: index + 1, text, timer_seconds: null })),
    substitutions: [],
    dietary_tags: [],
    allergen_warnings: [],
    source_url: url,
    source_domain: hostname,
  };
}
