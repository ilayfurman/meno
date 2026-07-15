# Meno iOS MVP (Expo + React Native + TypeScript)

Meno is an iOS-first dinner picker: answer a few constraints and generate 3 AI dinner options fast.

## Stack

- Expo + React Native + TypeScript
- React Navigation (native stack)
- AsyncStorage for local persistence
- OpenAI API call from client for dev only (legacy fallback)
- Zod schema validation and retry-on-invalid-JSON
- New backend scaffold: Fastify + Drizzle + Postgres (Neon-ready)

## Dev note

This MVP reads `EXPO_PUBLIC_OPENAI_API_KEY` from env and calls OpenAI directly in the client.

TODO: move OpenAI calls to a backend before production.

## Run

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Set your OpenAI key in `.env`:

```bash
EXPO_PUBLIC_OPENAI_API_KEY=...
```

4. Start app:

```bash
npm run ios
```

Alternative:

```bash
npm start
```

## Dev Client (replaces Expo Go)

The cookbook redesign needs native capabilities Expo Go can't provide (share-sheet target registration, native file picker, native PDF export/share) — see `docs/superpowers/specs/2026-07-15-cookbook-redesign-design.md`. Day-to-day development now runs through a custom EAS development client instead of the generic Expo Go app.

One-time setup (run these yourself — they need your own Expo account login):

```bash
npx eas-cli login          # log into your Expo account
npx eas-cli init           # links this project to an EAS project, writes extra.eas.projectId into app.json
npm run build:dev:ios      # cloud build, ~10-15 min; installs on device/simulator when done
npm run build:dev:android  # same, for Android
```

After that, day-to-day workflow is unchanged — `npm start` (now aliased to `expo start --dev-client`), open the app you just built instead of Expo Go, edit code, see it hot-reload. You only need to re-run a `build:dev:*` command when a *new* native module or config is added, not on every code change.

Note: registering Meno as an iOS/Android share-sheet **target** (so TikTok/Instagram/Safari can share *into* Meno) requires a native share-extension config plugin tied to your Apple Developer account (App Group identifier, provisioning) — that's a follow-up step once you have an Apple Developer account set up, not included in this pass. Everything else (native file picker for PDF import via `expo-document-picker`, native PDF generation via `expo-print`, and Meno-initiated native share sheet via `expo-sharing`) is already installed and works today via the dev client.

## Backend (new)

1. Install backend dependencies:

```bash
cd backend
npm install
cp .env.example .env
```

2. Set backend env values (`DATABASE_URL`, `OPENAI_API_KEY`).

3. Generate and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

4. Start backend:

```bash
npm run dev
```

5. Enable app -> backend routing (optional while migrating):

```bash
EXPO_PUBLIC_USE_BACKEND_GENERATION=true
EXPO_PUBLIC_API_BASE_URL=http://<your-machine-ip>:4000
EXPO_PUBLIC_DEV_CLERK_USER_ID=dev-local-user
```

When disabled, the app keeps using existing local/client generation behavior.

## MVP flow implemented

1. Onboarding (3 screens)
- Dietary restrictions
- Allergies
- Cuisine preferences + spice level
- Saved locally in AsyncStorage

2. Home
- Controls: time, vibe, difficulty
- Generate 3 options

3. Results
- 3 recipe cards
- Tap to open recipe detail
- Regenerate button

4. Recipe detail
- Ingredients, steps, substitutions
- Save recipe
- Regenerate recipe
- Swap ingredient (`replace X with Y`)

5. Cookbook
- Saved recipes list
- Search by name
- Tap to open

## Validation

Recipe JSON is validated with Zod at `src/ai/schemas.ts`.
If parsing/validation fails, generation retries once with a JSON-fix prompt.

## Key files

- `App.tsx`
- `src/navigation/AppNavigator.tsx`
- `src/ai/openai.ts`
- `src/ai/schemas.ts`
- `src/screens/*`
- `src/storage/*`
