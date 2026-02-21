# Meno iOS MVP (Expo + React Native + TypeScript)

Meno is an iOS-first dinner picker: answer a few constraints and generate 3 AI dinner options fast.

## Stack

- Expo + React Native + TypeScript
- React Navigation (native stack)
- AsyncStorage for local persistence
- OpenAI API call from client for dev only
- Zod schema validation and retry-on-invalid-JSON

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
