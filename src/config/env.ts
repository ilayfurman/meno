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

// Hardcoded fallbacks for the two values that turned out unreliable in a
// plain `expo run:ios --configuration Release` build (Metro's cache -- and
// possibly other build-tool quirks -- didn't reliably re-inline `.env`
// changes into that specific bundle, even though the exact same `.env` works
// fine through Expo Go and the dev client). Both values are safe to embed
// directly: the backend URL is public, and Clerk "publishable" keys are
// explicitly designed to ship in client code (unlike the backend's secret
// key). `.env` still overrides these when present, so nothing changes for
// Expo Go/dev-client, and swapping backends or Clerk apps later is still
// just an env var edit.
const FALLBACK_API_BASE_URL = 'https://meno-backend-slzk.onrender.com';
const FALLBACK_CLERK_PUBLISHABLE_KEY = 'pk_test_bWF4aW11bS1sYWNld2luZy0yMi5jbGVyay5hY2NvdW50cy5kZXYk';

export const API_BASE_URL = env.EXPO_PUBLIC_API_BASE_URL?.trim() || FALLBACK_API_BASE_URL;
export const DEV_CLERK_USER_ID = env.EXPO_PUBLIC_DEV_CLERK_USER_ID?.trim() ?? 'dev-local-user';
export const USE_BACKEND_GENERATION = parseBool(env.EXPO_PUBLIC_USE_BACKEND_GENERATION, false);
// Falls back to the real key rather than '' -- previously blank meant
// "dev-auth, no sign-in screen" (see App.tsx), but now that Clerk is fully
// set up and this is meant to work as a real standalone app, an accidentally
// (or unreliably) empty value should still result in working sign-in rather
// than silently downgrading to the shared dev-auth identity. To deliberately
// test the old dev-auth path locally, comment out this fallback temporarily.
export const CLERK_PUBLISHABLE_KEY = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || FALLBACK_CLERK_PUBLISHABLE_KEY;
