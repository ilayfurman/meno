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
  CLERK_SECRET_KEY: z.string().optional(),
  ALLOW_DEV_AUTH: z.coerce.boolean().default(true),
  DEV_FALLBACK_CLERK_USER_ID: z.string().default('dev-local-user'),
  ALLOWED_IMPORT_DOMAINS: z.string().default(''),
  GEN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(12),
  GEN_DAILY_LIMIT: z.coerce.number().int().positive().default(100),
  MAX_AGENT_RECIPES: z.coerce.number().int().positive().default(8),
  MAX_IMPORT_RESPONSE_BYTES: z.coerce.number().int().positive().default(5_242_880),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export const env = envSchema.parse(process.env);

export const allowedImportDomains = env.ALLOWED_IMPORT_DOMAINS.split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
