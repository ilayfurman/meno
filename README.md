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
