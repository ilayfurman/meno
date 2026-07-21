import { z } from 'zod';

// Nothing in this project ever called dotenv or Node's --env-file flag --
// .env loading has apparently been happening via something implicit in
// dev environments (shell config, an IDE integration, etc.), which is why
// this broke silently. process.loadEnvFile is Node's own built-in .env
// loader (no dependency needed, available since Node 20.12/21.7) -- this
// makes loading explicit and no longer dependent on how the process
// happens to get started. Wrapped in try/catch since production hosts
// inject real env vars directly and won't have a .env file at all.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env file found -- fine in production, or if env vars are already
  // set some other way.
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  // Groq hosts an OpenAI-compatible chat completions endpoint, so the `openai`
  // SDK works unmodified here — we just point it at Groq's baseURL. The
  // openai/gpt-oss models are the ones Groq actually supports strict
  // json_schema structured outputs on, which is what every AI call in this
  // service relies on, so don't swap the default model without checking that.
  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  // Separate model for image-based extraction (screenshot import) --
  // GROQ_MODEL above has no vision support. qwen/qwen3.6-27b is Groq's
  // current vision-capable model (as of mid-2026); it's a preview model, not
  // one of the strict-json_schema-guaranteed ones, so that call uses plain
  // JSON mode + zod validation instead of strict json_schema.
  GROQ_VISION_MODEL: z.string().default('qwen/qwen3.6-27b'),
  CLERK_SECRET_KEY: z.string().optional(),
  ALLOW_DEV_AUTH: z.coerce.boolean().default(true),
  DEV_FALLBACK_CLERK_USER_ID: z.string().default('dev-local-user'),
  ALLOWED_IMPORT_DOMAINS: z.string().default(''),
  GEN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(12),
  GEN_DAILY_LIMIT: z.coerce.number().int().positive().default(100),
  MAX_AGENT_RECIPES: z.coerce.number().int().positive().default(8),
  MAX_IMPORT_RESPONSE_BYTES: z.coerce.number().int().positive().default(5_242_880),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  // Used to build absolute, publicly-fetchable photo URLs (see the
  // /v1/recipes/:id/photo route) -- recipe/cookbook responses hand these
  // straight to the client's <Image> component, so they need to be full
  // URLs, not paths. Render sets RENDER_EXTERNAL_URL automatically on every
  // web service (https://<service>.onrender.com), so this only needs a
  // manual value for local dev.
  PUBLIC_BASE_URL: z.string().default(process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${process.env.PORT ?? '4000'}`),
  // Signs the `sig` query param on photo URLs (see buildPhotoUrl in
  // services/recipes.ts) so the photo route can stay reachable without a
  // Clerk session -- required for a plain <Image> tag to load it with no
  // custom headers -- while still not being open to anyone who happens to
  // see or guess a recipe's UUID. A URL is only ever valid if it was
  // actually signed by this secret, which only the server holds; nobody can
  // construct one without going through an authenticated API response
  // first. MUST be overridden with a real random value in production (e.g.
  // `openssl rand -hex 32`) -- the default here is fine for local dev only,
  // since anyone reading this source can forge signatures against it.
  PHOTO_URL_SECRET: z.string().default('dev-only-insecure-photo-secret-change-in-production'),
});

export const env = envSchema.parse(process.env);

// PHOTO_URL_SECRET has a default (unlike DATABASE_URL/GROQ_API_KEY/
// CLERK_SECRET_KEY below, which are required with no default) so local dev
// works with zero setup -- but that also means forgetting to set a real
// value in production wouldn't fail loudly on its own the way a genuinely
// required env var does. This closes that gap explicitly: refuse to boot in
// production while still sitting on the publicly-known dev default, since
// that would mean anyone can forge valid photo URLs against a real deploy.
if (env.NODE_ENV === 'production' && env.PHOTO_URL_SECRET === 'dev-only-insecure-photo-secret-change-in-production') {
  throw new Error(
    'PHOTO_URL_SECRET is still set to its insecure default in production. Set a real random value ' +
      '(e.g. `openssl rand -hex 32`) in the environment before starting the server.',
  );
}

export const allowedImportDomains = env.ALLOWED_IMPORT_DOMAINS.split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
