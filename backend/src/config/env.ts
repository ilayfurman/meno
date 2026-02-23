import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-5.2'),
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
