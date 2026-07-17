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
// Absent by default. Until this is set, the app skips ClerkProvider entirely
// and keeps working exactly as before (dev-auth header, no sign-in screen) —
// see App.tsx. Set this once a Clerk app has been created and its
// Publishable Key is available, to turn on real sign-in/sign-up.
export const CLERK_PUBLISHABLE_KEY = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
