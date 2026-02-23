declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

function parseBool(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

const env = process?.env ?? {};

export const API_BASE_URL = env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
export const DEV_CLERK_USER_ID = env.EXPO_PUBLIC_DEV_CLERK_USER_ID?.trim() ?? 'dev-local-user';
export const USE_BACKEND_GENERATION = parseBool(env.EXPO_PUBLIC_USE_BACKEND_GENERATION, false);
