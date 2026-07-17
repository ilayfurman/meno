# Cookbook Redesign — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Meno's screens to match `design_handoff_meno_cookbook_redesign/README.md` (ground truth for every layout/copy/interaction detail below — cited by section number, e.g. "§1 Cookbook") on top of the versioned backend from `docs/superpowers/plans/2026-07-15-backend-foundation.md`. Ships with a 2-tab bar (Cookbook, Profile) — Connect/MCP is out of scope (deferred per spec).

**Architecture:** Keep Expo/RN/TypeScript/React Navigation. Replace the flat local-first `Recipe` model and `src/storage/cookbook.ts` outbox pattern with a thin API client (`src/api/backend.ts`) that talks directly to the new versioned backend endpoints — the app becomes backend-required (no more AsyncStorage-first-then-sync; the redesign's MCP-readiness and versioning make an always-online model the right simplification, and Quick Generate/import already require the backend). Existing generation orchestration in `App.tsx`/`AppContext` (summary→hydrate pipeline) is reused, not rewritten, for the new Quick Generate sheet.

**Tech Stack:** Expo + React Native + TypeScript, React Navigation (native stack), `expo-document-picker`, `expo-sharing`, `expo-print`, `expo-file-system`.

**Note on granularity:** shared foundation (theme, types, API client, navigation, primitive components) is specified with exact code below. Per-screen tasks specify exact file paths, props/state shapes, and behavior by citing the design doc's numbered sections verbatim rather than re-deriving layout prose — the design doc is the JSX spec. Each screen task's Definition of Done is "matches the cited section" + typecheck passes.

---

### Task 1: Theme tokens matching the design system

**Files:**
- Modify: `src/theme/colors.ts`
- Modify: `src/theme/typography.ts`
- Create: `src/theme/spacing.ts`

- [ ] **Step 1: Replace `colors.ts`** with the design doc's token set (design doc "Design Tokens > Colors"):

```typescript
export const colors = {
  background: '#ffffff',
  foreground: '#1c1a17',
  subtext: '#8a8479',
  accent: '#c1552f',
  accent2: '#5c7a52',
  matBackground: '#fbf8f2',
  hairline: '#ece7dc',
  hairlineAlt: '#ece2d0',
  successDot: '#3d8a52',
  offDot: '#cfc7b5',
  danger: '#c1552f',
  // legacy aliases kept during migration — remove once all screens are converted
  surface: '#ffffff',
  textPrimary: '#1c1a17',
  textSecondary: '#8a8479',
  primaryAccent: '#c1552f',
  secondaryAccent: '#5c7a52',
  border: '#ece7dc',
};
```

- [ ] **Step 2: Replace `typography.ts`** (design doc "Design Tokens > Typography" — DM Sans isn't bundled by default in Expo; use system font for this pass and note the gap rather than silently guessing a font-loading setup):

```typescript
export const typography = {
  screenTitle: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  sectionKicker: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  cardTitle: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 13, fontWeight: '400' as const },
  tag: { fontSize: 11, fontWeight: '700' as const },
  // legacy aliases kept during migration
  titleLarge: 28,
  sectionHeader: 22,
  body: 16,
  chip: 14,
};
```

Note in a code comment: "DM Sans / JetBrains Mono not installed — using system font. Add via `expo-font` + `@expo-google-fonts/dm-sans` in a follow-up pass; out of scope here since it's a pure asset-loading addition orthogonal to the layout rebuild."

- [ ] **Step 3: Create `spacing.ts`** (design doc "Design Tokens > Spacing / shape"):

```typescript
export const spacing = {
  screenPadding: 18,
  radiusCard: 18,
  radiusSheet: 28,
  radiusPill: 999,
  gridGap: 12,
};
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: fails at existing screens still referencing removed color/typography keys — expected, fixed as each screen is rebuilt in later tasks. Note the failing file list.

- [ ] **Step 5: Commit**

```bash
git add src/theme/
git commit -m "feat(theme): adopt cookbook-redesign design tokens"
```

---

### Task 2: API client + types matching the versioned backend

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/types/cookbook.ts`
- Rewrite: `src/api/backend.ts`

- [ ] **Step 1: Add versioned recipe types to `src/types/index.ts`**, alongside (not replacing yet — `Recipe` is still used by the generation pipeline's in-memory AI response shape) the existing `Recipe`/`Ingredient`/`RecipeStep` types:

```typescript
export interface RecipeVersion {
  id?: string;
  version_number: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  change_note: string | null;
  created_at?: string | null;
}

export type VideoPlatform = 'tiktok' | 'instagram' | 'youtube' | 'other';

export interface StoredRecipe {
  id: string;
  title: string;
  cuisine: string;
  servings: number;
  total_time_minutes: number;
  difficulty: string;
  short_hook: string;
  dietary_tags: string[];
  allergen_warnings: string[];
  video_url: string | null;
  video_platform: VideoPlatform | null;
  is_favorite: boolean;
  current_version: RecipeVersion;
  versions: RecipeVersion[];
}

export interface UserPreferencesV2 {
  diet: string | null;
  avoid: string[];
  notify_recipe_saved: boolean;
  notify_weekly_digest: boolean;
  notify_product_updates: boolean;
}
```

- [ ] **Step 2: Replace `src/types/cookbook.ts`** with the design doc's Cookbook view-state shape (design doc "State Management"):

```typescript
export type CookbookSortKey = 'recent' | 'title_asc' | 'time_asc' | 'time_desc';
export type CookbookFilter = 'all' | 'favorites' | string; // string = a cuisine name

export interface CookbookViewState {
  searchQuery: string;
  activeFilter: CookbookFilter;
  sortBy: CookbookSortKey;
}

export const defaultCookbookViewState: CookbookViewState = {
  searchQuery: '',
  activeFilter: 'all',
  sortBy: 'recent',
};
```

Delete the old `CookbookMode`, `CookbookQuickFilter`, `CookbookFilterState`, `defaultCookbookFilters` exports — grep for their usages first (`grep -rn "CookbookFilterState\|CookbookQuickFilter\|defaultCookbookFilters\|CookbookMode" src/`) and note every call site; those call sites are in screens rebuilt later in this plan, so leaving them broken here is expected and fixed per-screen. `ChatMessage` stays (still used by "Continue iterating" / agent chat).

- [ ] **Step 3: Rewrite `src/api/backend.ts`**. Keep `askAgentViaBackend` as-is (still used, unrelated to this refactor) and the `generateRecipesViaBackend`/`generateRecipeSummariesViaBackend`/`hydrateRecipeViaBackend` functions as-is (Quick Generate's in-memory pipeline, untouched). Replace everything from `getCookbookViaBackend` through `reorderCookbookViaBackend` with:

```typescript
export async function getCookbookViaBackend(): Promise<StoredRecipe[]> {
  const data = await backendFetch<{ recipes: StoredRecipe[] }>('/v1/cookbook');
  return data.recipes;
}

export async function getRecipeViaBackend(recipeId: string): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}`);
  return data.recipe;
}

export interface CreateRecipePayload {
  title: string;
  cuisine: string;
  servings: number;
  total_time_minutes: number;
  difficulty: string;
  short_hook: string;
  dietary_tags: string[];
  allergen_warnings: string[];
  video_url?: string | null;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  change_note?: string | null;
  source_type: 'generated' | 'link' | 'pdf' | 'text';
  source_url?: string | null;
}

export async function createRecipeViaBackend(payload: CreateRecipePayload): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>('/v1/recipes', { method: 'POST', body: payload });
  return data.recipe;
}

export async function addRecipeVersionViaBackend(
  recipeId: string,
  payload: { ingredients: Ingredient[]; steps: RecipeStep[]; change_note?: string | null; set_as_current: boolean },
): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}/versions`, {
    method: 'POST',
    body: payload,
  });
  return data.recipe;
}

export async function setCurrentVersionViaBackend(recipeId: string, versionId: string): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}/current-version`, {
    method: 'PATCH',
    body: { version_id: versionId },
  });
  return data.recipe;
}

export async function deleteRecipeVersionViaBackend(
  recipeId: string,
  versionId: string,
): Promise<{ deletedRecipe: boolean; recipe: StoredRecipe | null }> {
  return backendFetch(`/v1/recipes/${recipeId}/versions/${versionId}`, { method: 'DELETE' });
}

export async function deleteRecipeViaBackend(recipeId: string): Promise<void> {
  await backendFetch(`/v1/recipes/${recipeId}`, { method: 'DELETE' });
}

export async function setVideoLinkViaBackend(recipeId: string, videoUrl: string | null): Promise<StoredRecipe> {
  const data = await backendFetch<{ recipe: StoredRecipe }>(`/v1/recipes/${recipeId}/video-link`, {
    method: 'PUT',
    body: { video_url: videoUrl },
  });
  return data.recipe;
}

export async function setFavoriteViaBackend(recipeId: string, isFavorite: boolean): Promise<void> {
  await backendFetch(`/v1/cookbook/items/${recipeId}/favorite`, { method: 'PUT', body: { is_favorite: isFavorite } });
}

export async function removeRecipeViaBackend(recipeId: string): Promise<void> {
  await backendFetch(`/v1/cookbook/items/${recipeId}`, { method: 'DELETE' });
}

export async function reorderCookbookViaBackend(recipeIds: string[]): Promise<void> {
  await backendFetch('/v1/cookbook/items/reorder', { method: 'PATCH', body: { recipeIds } });
}

export async function getPreferencesViaBackend(): Promise<{ preferences: UserPreferencesV2; plan: string }> {
  return backendFetch('/v1/preferences');
}

export async function updatePreferencesViaBackend(update: Partial<UserPreferencesV2>): Promise<{ preferences: UserPreferencesV2 }> {
  return backendFetch('/v1/preferences', { method: 'PATCH', body: update });
}
```

Add `StoredRecipe`, `UserPreferencesV2`, `Ingredient`, `RecipeStep` to the top-of-file type import from `'../types'`. Remove the `isBackendEnabled()` gate from these new functions' call sites — per this plan's architecture note, the app is now backend-required, so these calls assume `API_BASE_URL` is configured; `ensureConfigured()` inside `backendFetch` already throws a clear error if not, which is the correct failure mode (was previously masked by local-first fallback).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/types/cookbook.ts src/api/backend.ts
git commit -m "feat(api): add versioned-recipe API client and types"
```

---

### Task 3: Delete the local-first cookbook storage layer

**Files:**
- Delete: `src/storage/cookbook.ts`
- Modify: `App.tsx`, `src/navigation/AppContext.tsx`

- [ ] **Step 1: Read both files fully first** (`App.tsx`, `src/navigation/AppContext.tsx`) to find every call site of the functions being deleted (`saveRecipeToCookbook`, `removeRecipeFromCookbook`, `saveRecipeRevision`, `getCookbookSyncError`, `retryCookbookSync`, `flushCookbookOutbox`, `moveRecipesToTop`, `clearCookbook`, `setCookbookOrder`, `removeRecipesFromCookbook`) — grep: `grep -rn "storage/cookbook" src/ App.tsx`.

- [ ] **Step 2: Delete `src/storage/cookbook.ts`.**

- [ ] **Step 3: Update `App.tsx`** — remove the `flushCookbookOutbox()` call in the startup `useEffect`, remove the `saveRecipe`/`removeRecipe`/`saveRecipeRevision` wrapper functions and their imports from `./src/storage/cookbook`. The Cookbook screen (Task 5) and Recipe Detail screen (Task 6) call the new `src/api/backend.ts` functions directly instead of going through `AppContext` wrappers for cookbook CRUD — `AppContext` keeps only what generation orchestration still needs (preferences, billing, userProfile, generation run state).

- [ ] **Step 4: Update `src/navigation/AppContext.tsx`** to drop `saveRecipe`/`removeRecipe`/`saveRecipeRevision` from its context value and type, matching Step 3.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: fails at every screen that called the removed `AppContext` methods — expected, listed and fixed in later per-screen tasks.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove local-first cookbook storage, cookbook is backend-only"
```

---

### Task 4: Shared primitive components

**Files:**
- Create: `src/components/MattedPhoto.tsx`
- Create: `src/components/TagPill.tsx`
- Create: `src/components/PressableScale.tsx`
- Create: `src/components/BottomSheet.tsx`

- [ ] **Step 1: `PressableScale.tsx`** — wraps `Pressable`, applies the ~0.93-0.97 press-scale feedback described in design doc "Interactions & Behavior > Tactile press feedback" to any child, via `Animated.spring` on `pressIn`/`pressOut`. Props: `{ onPress?: () => void; onLongPress?: () => void; scaleTo?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }`, default `scaleTo = 0.95`.

- [ ] **Step 2: `MattedPhoto.tsx`** — the cream-mat photo frame described in design doc "Why the visual direction is digital cookbook" and used throughout. Props: `{ uri?: string | null; aspectRatio?: number; borderRadius?: number }`. Renders a `colors.matBackground` container with the image inset by ~6px on each side (the "mat" border); when `uri` is absent, renders the diagonal-stripe placeholder pattern (a simple repeating `View` pattern or a single `Text` "recipe photo" centered — the design doc explicitly says real photos aren't sourced yet, so this placeholder ships to production for now) labeled "recipe photo".

- [ ] **Step 3: `TagPill.tsx`** — Props: `{ label: string; variant: 'version' | 'source' | 'neutral' }`. `version` → coral-tinted (`colors.accent` at low opacity background, `colors.accent` text), `source` → sage-tinted (`colors.accent2` equivalents), `neutral` → `colors.hairline` background. Matches design doc §1 "Recipe card" tag chip description (`vN` badge, `from {Claude/ChatGPT}` badge).

- [ ] **Step 4: `BottomSheet.tsx`** — the reusable small-popup wrapper for Share/Import/video-editor/sign-out-confirm/sort-dropdown per design doc "Interactions & Behavior > Small popups vs. full sheets". Props: `{ visible: boolean; onDismiss: () => void; children: React.ReactNode; maxHeightPercent?: number }`, default `maxHeightPercent = 80`. Renders a `Modal` (`transparent`, `animationType="none"` — animate manually) with a dimmed scrim `Pressable` (tap-outside-to-dismiss, `rgba(28,26,23,0.4)`) behind a `View` sliding up from the bottom (`Animated.timing` on `translateY`, ~380ms ease-out, matching design doc's "Modal presentation" timing) with `borderTopLeftRadius`/`borderTopRightRadius` of `spacing.radiusSheet`, capped at `maxHeightPercent` of screen height with a `ScrollView` inside if content overflows.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors introduced by these 4 new files (existing errors from prior tasks persist — fine).

- [ ] **Step 6: Commit**

```bash
git add src/components/MattedPhoto.tsx src/components/TagPill.tsx src/components/PressableScale.tsx src/components/BottomSheet.tsx
git commit -m "feat(components): add shared primitives for cookbook redesign (matted photo, tag pill, press-scale, bottom sheet)"
```

---

### Task 5: Navigation restructure — 2-tab bar

**Files:**
- Modify: `src/types/navigation.ts`
- Modify: `src/navigation/MainTabsScreen.tsx` (relocate logic into `src/screens/MainTabsScreen.tsx`, already exists there — modify in place)
- Modify: `src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Update `MainTabParamList`** in `src/types/navigation.ts` to 2 tabs:

```typescript
export type MainTabParamList = {
  Cookbook: undefined;
  Profile: undefined;
};
```

Add new stack routes for the full-screen takeovers (design doc "Interactions & Behavior > full-screen takeovers"):

```typescript
export type RootStackParamList = {
  MainTabs: undefined;
  RecipeDetail: { recipeId: string };
  QuickGenerate: undefined;
  ProfileDietary: undefined;
  ProfileNotifications: undefined;
  ProfileHelpCenter: undefined;
  ProfileContactUs: undefined;
  ProfileRateMeno: undefined;
  ProfileTerms: undefined;
  ProfilePrivacy: undefined;
  ProfilePlans: undefined;
  // retained from onboarding, unrelated to this redesign
  OnboardingDiet: undefined;
  OnboardingAllergies: undefined;
  OnboardingPrefs: undefined;
};
```

Delete `Results`, `Account`, `FoodPreferences`, `Billing`, `Support` route params (superseded by the Profile subpages above) and the `Explore`/`Tonight` tab entries. Note every deleted key's screen file is deleted in Task 10 (Profile) and Task 9 (Quick Generate) — don't delete the screen files yet in this task, just the nav types; deleting nav types first and fixing fallout per-screen keeps the typecheck-driven checklist accurate.

- [ ] **Step 2: Rewrite `src/screens/MainTabsScreen.tsx`** as a floating pill-shaped tab bar per design doc "Interactions & Behavior > Tab bar": positioned `absolute` near the bottom with horizontal margin, `borderRadius: spacing.radiusPill`, `colors.foreground` background, 2 items (Cookbook, Profile) with `PressableScale`-wrapped tab buttons, active tab tinted `colors.accent`. Content area renders `CookbookScreen` or `ProfileScreen` based on active tab state (same pattern as the current file, just 2 tabs instead of 4 and restyled).

- [ ] **Step 3: Update `src/navigation/AppNavigator.tsx`** — replace the stack screen list with the routes from Step 1's `RootStackParamList`, each `RecipeDetail`/`QuickGenerate`/`Profile*` screen registered with `presentation: 'modal'` matching the "full-screen takeover, own back button, no header chrome" pattern (`headerShown: false`, screens render their own back/close button per design doc).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: fails at every screen referencing deleted route names — expected, fixed in Tasks 6-10.

- [ ] **Step 5: Commit**

```bash
git add src/types/navigation.ts src/screens/MainTabsScreen.tsx src/navigation/AppNavigator.tsx
git commit -m "feat(nav): restructure to 2-tab bar (Cookbook, Profile) + modal takeovers"
```

---

### Task 6: Cookbook screen (design doc §1)

**Files:**
- Rewrite: `src/screens/CookbookScreen.tsx`

- [ ] **Step 1: Implement per design doc §1 "Cookbook (home tab)"** exactly: header kicker "Cookbook" + title "Everything you've saved & refined"; search row (search `TextInput` + 44×44 "+" import button opening the Add-a-recipe `BottomSheet` from Task 7); horizontal filter pill row (All / Favorites / cuisine names derived from loaded recipes via `Array.from(new Set(recipes.map(r => r.cuisine)))`) + Sort dropdown (Recently saved / A-Z / Time low-high / Time high-low, opened as a small `BottomSheet`); "No AI connected?" entry card (visible only when `activeFilter === 'all' && searchQuery === ''`, per design doc, opens Quick Generate on tap); 2-column `FlatList` grid of recipe cards.
- [ ] **Step 2: Recipe card** — new component `src/components/CookbookRecipeCard.tsx`: `MattedPhoto`, heart favorite toggle (top-right circular button over the photo, calls `setFavoriteViaBackend` optimistically then reconciles), title, meta line (`{current_version time} min · {cuisine}` — time comes from the parent `StoredRecipe.total_time_minutes`), `TagPill` row (`vN` `variant="version"` if `versions.length > 1`, `from {video_platform display name}` `variant="source"` only if the design doc's AI-sourced condition applies — re-check: design doc ties this pill to AI-sourced recipes, i.e. `source_type === 'generated'` mapped to which assistant made it; since MCP is deferred there is no Claude/ChatGPT source yet, so **omit the "from X" pill entirely for v1** and note this explicitly as a deferred-with-MCP item, not a bug). Card press navigates to `RecipeDetail` with `{ recipeId }`. Wrap in `PressableScale`.
- [ ] **Step 3: Data loading** — `useEffect` calls `getCookbookViaBackend()` on mount and on focus (use `useFocusEffect` from `@react-navigation/native` so returning from Recipe Detail after an edit refreshes the list); local `useState<StoredRecipe[]>`. Client-side filter/search/sort exactly as design doc "Search/filter/sort" describes (substring match on title, mutually exclusive filter, sort combining with filter+search).
- [ ] **Step 4: Empty state** — design doc's exact copy: "No recipes match — try a different search or filter."
- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: `CookbookScreen.tsx` and `CookbookRecipeCard.tsx` compile clean; other files' pre-existing failures persist.

- [ ] **Step 6: Commit**

```bash
git add src/screens/CookbookScreen.tsx src/components/CookbookRecipeCard.tsx
git commit -m "feat(cookbook): rebuild Cookbook screen per redesign spec"
```

---

### Task 7: Add a recipe (import) sheet (design doc §4)

**Files:**
- Create: `src/components/ImportRecipeSheet.tsx`

- [ ] **Step 1: Implement per design doc §4** exactly: `BottomSheet` with title "Add a recipe" / subtitle "Claude formats it for your cookbook"; 3-way segmented control (Link / PDF / Text) — reuse `src/components/SegmentedControl.tsx` (already exists, check its prop shape first with `Read`); exactly one input per segment (Link: `TextInput` placeholder "Paste a recipe link"; PDF: dashed drop-zone `Pressable` that calls `expo-document-picker`'s `getDocumentAsync({ type: 'application/pdf' })` immediately on tap, then shows the picked filename; Text: multiline `TextInput` placeholder "Paste recipe text — from WhatsApp, Notes, anywhere").
- [ ] **Step 2: Submit flow** — Cancel (ghost) / "Import with Claude" (primary) buttons. On confirm: swap sheet content in place (not close) to a "Formatting your recipe… Claude is structuring ingredients, steps, and tags" processing state, call the appropriate backend path:
  - Link → `POST /v1/recipes/import-url` (existing route, already handles schema.org JSON-LD extraction) via a new `importRecipeFromUrlViaBackend(url)` function added to `src/api/backend.ts` wrapping `backendFetch('/v1/recipes/import-url', { method: 'POST', body: { url } })`.
  - PDF/Text → **not implemented by the existing backend** (no PDF-parsing or freeform-text-to-recipe AI route exists yet). This is a real gap, not something to fake: add it as new backend work, out of scope for this frontend-only plan. For this pass, wire the Link segment fully; for PDF/Text segments, keep the UI exactly as designed but have the submit handler show an inline `Text` note "Text and PDF import are coming soon — try a link for now" instead of calling a nonexistent endpoint, so the screen is honest about current capability rather than silently failing. Flag this gap in the final QC summary.
- [ ] **Step 3: Success state** — "Saved to your Cookbook — {title} is ready" + Done button that closes the sheet and calls the parent's refresh callback (Cookbook screen's `useFocusEffect`-driven reload already covers this if the sheet is dismissed via navigation, but since this is a same-screen sheet not a navigation transition, pass an explicit `onImported: (recipe: StoredRecipe) => void` prop from `CookbookScreen` that prepends the new recipe to local state immediately).
- [ ] **Step 4: Typecheck + manual review** against design doc §4 line-by-line.
- [ ] **Step 5: Commit**

```bash
git add src/components/ImportRecipeSheet.tsx src/api/backend.ts
git commit -m "feat(import): add recipe import sheet (link import functional, PDF/text UI-only pending backend)"
```

---

### Task 8: Recipe Detail screen + video attachment + share sheet (design doc §2, §3, §5)

**Files:**
- Rewrite: `src/screens/RecipeDetailScreen.tsx`
- Create: `src/components/VideoAttachmentCard.tsx`
- Create: `src/components/ShareRecipeSheet.tsx`
- Create: `src/components/ContinueIteratingSheet.tsx`
- Create: `src/utils/recipeExport.ts`

- [ ] **Step 1: `RecipeDetailScreen.tsx` per design doc §2** — receives `{ recipeId }` from route params, loads via `getRecipeViaBackend(recipeId)` on mount. Layout: "‹ Back to Cookbook" link, `MattedPhoto` (large), title/meta/tag chips, `VideoAttachmentCard` (Step 2) or dashed "+ Add a video link" row, version pill strip (only if `versions.length > 1`) that swaps displayed `ingredients`/`steps`/change-note on tap by calling `setCurrentVersionViaBackend` — **note**: design doc says "switching versions is local/instant, no network round-trip implied" for *display*, but persisting which version is "current" (so it's what shows next time / on the card) does need a backend call; implement local-instant display switching in component state (`activeVersionIndex`, matching design doc's "State Management" section) and only call `setCurrentVersionViaBackend` when the user explicitly picks a version as current — for v1, tapping a version pill both displays it AND sets it current in one action (no separate "set as default" affordance was specified, so tap = view = set current, kept simple). Action row: Favorite toggle, Share (opens Task 8 Step 3 sheet), "Continue iterating" (opens Step 4 sheet). Ingredients/Steps sections.
- [ ] **Step 2: `VideoAttachmentCard.tsx` per design doc §3** — Props: `{ videoUrl: string; videoPlatform: VideoPlatform; onEdit: () => void }`. Platform-styled per spec (tiktok: black bg + cyan icon; instagram: gradient bg + white icon; youtube: white bg + red play icon; other: cream bg + sage icon). Tapping the card body opens the URL via `Linking.openURL`. Pencil-icon button (top-right) triggers `onEdit`. The edit sheet itself (single URL input, Cancel/Remove/Save) is a small inline `BottomSheet` owned by `RecipeDetailScreen`, calling `setVideoLinkViaBackend(recipeId, url | null)`.
- [ ] **Step 3: `ShareRecipeSheet.tsx` per design doc §5`** — `BottomSheet` with 3 rows (Meno link / PDF / Copy as text):
  - Meno link: **no web viewer companion exists** (design doc flags this as a dependency that may not exist yet — confirmed absent from this codebase). For v1, generate a `meno://recipe/{id}` deep link string (no actual deep-link handling wired up yet either — out of scope) and hand it to `expo-sharing`'s `shareAsync` if a URL-only share is supported, otherwise fall back to `Share` from `react-native`'s core API for a plain-text share of the link string. Flag in final QC that the "opens read-only in Meno app or web" promise isn't backed by a real viewer yet.
  - PDF: build via `expo-print`'s `printToFileAsync({ html })` where `html` is generated by `src/utils/recipeExport.ts`'s `buildRecipeHtml(recipe: StoredRecipe): string` (simple print-styled template: title, ingredients `<ul>`, steps `<ol>`), then `expo-sharing`'s `shareAsync(uri)` to invoke the native share sheet.
  - Copy as text: `src/utils/recipeExport.ts`'s `buildRecipePlainText(recipe: StoredRecipe): string`, copied via `expo-clipboard` (**not yet installed** — add it: `npx expo install expo-clipboard`), then a brief "Copied ✓" confirmation state per design doc.
- [ ] **Step 4: `ContinueIteratingSheet.tsx` per design doc "Continue iterating"** — small sheet showing a structured copyable text block (title, ingredients, steps, full version history with change notes) built by a new `buildContinueIteratingText(recipe: StoredRecipe): string` in `recipeExport.ts`; Copy button with "Copied ✓" state via `expo-clipboard`.
- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean for these 5 files; run `npx expo install expo-clipboard` first if not already present.

- [ ] **Step 6: Commit**

```bash
git add src/screens/RecipeDetailScreen.tsx src/components/VideoAttachmentCard.tsx src/components/ShareRecipeSheet.tsx src/components/ContinueIteratingSheet.tsx src/utils/recipeExport.ts package.json package-lock.json
git commit -m "feat(recipe-detail): rebuild Recipe Detail with versioning, video attachment, share, continue-iterating"
```

---

### Task 9: Quick Generate (design doc §7) — restyle existing generation flow

**Files:**
- Modify: `src/screens/TonightScreen.tsx` → rename to `src/screens/QuickGenerateScreen.tsx`
- Delete: `src/screens/ResultsScreen.tsx`, `src/screens/ExploreScreen.tsx`

- [ ] **Step 1: Read `TonightScreen.tsx` and `ResultsScreen.tsx` in full first** to identify exactly which `AppContext` generation-orchestration calls (summary generation, hydration, run state) are reused versus which UI is discarded.
- [ ] **Step 2: Rewrite as `QuickGenerateScreen.tsx`**, presented as a full-height modal sheet (no scrim, per design doc §7 "unlike Import/Share, is a full takeover") reachable from Cookbook's "No AI connected?" card and (once built) a similar entry elsewhere. Layout per design doc §7: hero copy, 2×2 vibe icon grid (🍲 Comfort / 🥗 Fresh / 🍗 High-Protein / 🥣 Light — fix the existing icon-label mismatch bug the design doc explicitly calls out: "icons must match their labels, this was a bug in the old app" — check `TonightScreen.tsx`'s current icon mapping against this exact list and correct it), time pill row (15/30/45), difficulty pill row (Easy/Medium), primary CTA "Give me 3 ideas", fine print "Uses Meno's built-in model — counts toward your monthly quota." Reuse the existing `generateRecipeSummariesViaBackend`/hydration pipeline from `AppContext` unchanged — this task is a visual restyle, not a logic rewrite.
- [ ] **Step 3: On generate**, results replace the sheet's content in place (matching the "no separate Results page" simplification implied by design doc's "brief loading state, then a result confirmation" — fold what `ResultsScreen.tsx` did into this same sheet rather than navigating to a separate screen) and end with copy encouraging connecting Claude/ChatGPT for richer results next time (static copy, since Connect isn't built yet).
- [ ] **Step 4: Delete `ResultsScreen.tsx`.** Check `ExploreScreen.tsx`'s purpose first (`Read` it) — the design doc has no Explore tab or equivalent; if it's dead weight after the nav restructure (Task 5 already dropped the Explore tab), delete it too; if it's referenced elsewhere, note that instead of deleting blindly.
- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean for `QuickGenerateScreen.tsx`; confirm no remaining references to `ResultsScreen`/`ExploreScreen`/`TonightScreen` (`grep -rn "ResultsScreen\|ExploreScreen\|TonightScreen" src/ App.tsx`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(quick-generate): restyle Tonight->QuickGenerate as full-sheet secondary entry, fix vibe icon/label mismatch"
```

---

### Task 10: Profile + subpages (design doc §8)

**Files:**
- Rewrite: `src/screens/ProfileScreen.tsx`
- Create: `src/screens/profile/DietaryPreferencesScreen.tsx`
- Create: `src/screens/profile/NotificationsScreen.tsx`
- Create: `src/screens/profile/HelpCenterScreen.tsx`
- Create: `src/screens/profile/ContactUsScreen.tsx`
- Create: `src/screens/profile/RateMenoScreen.tsx`
- Create: `src/screens/profile/TermsScreen.tsx`
- Create: `src/screens/profile/PrivacyScreen.tsx`
- Create: `src/screens/profile/PlansScreen.tsx`
- Delete: `src/screens/AccountScreen.tsx`, `src/screens/FoodPreferencesScreen.tsx`, `src/screens/BillingScreen.tsx`, `src/screens/SupportScreen.tsx`

- [ ] **Step 1: Read the 4 screens being deleted first** to carry forward any still-relevant logic (e.g. sign-out, existing FAQ copy) into their replacements rather than discarding it.
- [ ] **Step 2: `ProfileScreen.tsx` per design doc §8** — identity row (avatar initial, name, email from `userProfile`), stat row (3 tiles: Recipes count from cookbook length, Connected count — hardcode `0` since Connect doesn't exist yet, Favorites count), plan card (dark, calls `getPreferencesViaBackend()` for `plan`, "Upgrade" pill → `ProfilePlans`), grouped sections (Preferences: Dietary & allergies row showing a live summary from `getPreferencesViaBackend()`, Notifications row; Connections: **omit entirely for v1** — Connect tab doesn't exist, so these two rows have nothing to link to; Support: Help Center/Contact us/Rate Meno; Legal: Terms/Privacy), standalone Sign out row opening a small confirm `BottomSheet` (Cancel/Sign out).
- [ ] **Step 3: `DietaryPreferencesScreen.tsx` per design doc §8** — two chip groups (Diet: Vegetarian/Vegan/Pescatarian/Omnivore, single-select; Avoid: No Nuts/No Dairy/No Gluten/No Shellfish, multi-select), each chip toggle calls `updatePreferencesViaBackend({ diet })` / `updatePreferencesViaBackend({ avoid })` on change (optimistic local state, matching design doc "Profile: dietary/allergy selections... persisted to the user's account, not local-only"). This screen becomes the one canonical editor for dietary/allergy data — the old onboarding screens' separate `dietaryRestrictionOptions`/`allergyOptions` vocab is superseded by this screen's Diet/Avoid vocab; leave onboarding screens as first-run-only setup that also writes through `updatePreferencesViaBackend` (Task 11 covers reconciling onboarding).
- [ ] **Step 4: `NotificationsScreen.tsx`** — 3 rows (New recipe saved / Weekly digest / Product updates), each a label + one-line description + native `Switch`, calling `updatePreferencesViaBackend({ notify_recipe_saved / notify_weekly_digest / notify_product_updates })`.
- [ ] **Step 5: `HelpCenterScreen.tsx`** — search input (client-side substring filter) + expandable FAQ list. Carry forward any existing FAQ copy from the deleted `SupportScreen.tsx` if present; otherwise write 4-5 short placeholder-free real FAQ entries covering: saving a recipe, versioning, importing, favoriting, connecting an AI (mark the last one "Coming soon").
- [ ] **Step 6: `ContactUsScreen.tsx`** — read-only email field (from `userProfile.email`), message textarea, Send button. No backend endpoint exists for this — send via `Linking.openURL('mailto:...')` pre-filled with the message as the mail body (a real, working mechanism, not a fake "sent" state) rather than fabricating a backend call that doesn't exist.
- [ ] **Step 7: `RateMenoScreen.tsx`** — centered 5-star display (non-interactive decoration, per design doc just a visual), "Rate on the App Store" button using `Linking.openURL` with the App Store review URL scheme (`itms-apps://itunes.apple.com/app/idYOUR_APP_ID?action=write-review` — **placeholder app ID**, since no App Store listing exists yet; leave a code comment marking exactly where to fill in the real ID once the app is published, this is a genuine external dependency not a plan gap), "Not now" dismiss.
- [ ] **Step 8: `TermsScreen.tsx` / `PrivacyScreen.tsx`** — static document pages with section headers. **No legal copy exists in this repo or the design doc** (design doc explicitly doesn't include legal text, only layout). Render the page chrome (title, section header style) with a single visible placeholder paragraph stating real legal copy is pending counsel review — this is the one legitimate case for placeholder content in this plan, since fabricating actual Terms of Service / Privacy Policy text would be worse than an honest gap.
- [ ] **Step 9: `PlansScreen.tsx` per design doc §8 "Plans"** — two stacked cards (Free / Meno Plus $4.99/mo) with feature lists (write real, specific feature differences based on what's actually built: Free = Quick Generate + manual save/import; Plus = higher Quick Generate quota + priority import processing — keep modest and truthful, no fabricated features), "Current plan" badge from `getPreferencesViaBackend().plan`, selectable border/tint, CTA button. **No purchase flow** (StoreKit/RevenueCat is explicitly out of scope per the backend spec) — the CTA for upgrading shows an inline "Upgrades aren't available yet — coming soon" message rather than a fake purchase button that does nothing.
- [ ] **Step 10: Typecheck**

Run: `npm run typecheck`
Expected: clean for all Profile files.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(profile): rebuild Profile + 8 subpages per redesign spec"
```

---

### Task 11: Onboarding reconciliation + final wiring

**Files:**
- Modify: `src/screens/OnboardingDietScreen.tsx`, `src/screens/OnboardingAllergiesScreen.tsx`, `src/screens/OnboardingPrefsScreen.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Read all 3 onboarding screens first.** Update them to write through `updatePreferencesViaBackend` using the new Diet/Avoid vocabulary from Task 10 Step 3 (Vegetarian/Vegan/Pescatarian/Omnivore, No Nuts/No Dairy/No Gluten/No Shellfish) instead of the old `dietaryRestrictionOptions`/`allergyOptions` arrays, so onboarding and the Profile > Dietary screen share one source of truth from day one. `OnboardingPrefsScreen.tsx`'s cuisine/spice-level collection stays local-only (`AppContext` `preferences`) since the redesign doesn't surface those anywhere new — leave that part unchanged.
- [ ] **Step 2: Update `App.tsx`** — remove any remaining references to deleted screens/types from earlier tasks (final sweep: `grep -rn "AccountScreen\|FoodPreferencesScreen\|BillingScreen\|SupportScreen\|ResultsScreen\|ExploreScreen" App.tsx src/`, expect zero matches).
- [ ] **Step 3: Full typecheck**

Run: `npm run typecheck`
Expected: 0 errors across the whole app.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(onboarding): write through new preferences vocabulary; final redesign wiring sweep"
```

---

### Task 12: Final frontend validation

- [ ] **Step 1:** `npm run typecheck` — expect 0 errors.
- [ ] **Step 2:** `npx expo-doctor` — review output, fix anything actionable, note anything environmental (e.g. missing EAS project link) that requires the user's own account.
- [ ] **Step 3:** `npx expo config --json` — confirm it still resolves without throwing.
- [ ] **Step 4:** Grep sweep for dead imports of everything deleted in this plan: `grep -rln "storage/cookbook\|ResultsScreen\|ExploreScreen\|AccountScreen\|FoodPreferencesScreen\|BillingScreen\|SupportScreen" src/ App.tsx` — expect no output.
- [ ] **Step 5:** Compile a short gap list from every "flag in final QC" note left in Tasks 7-10 (PDF/text import stub, no Meno-link web viewer, no purchase flow, placeholder App Store ID, placeholder legal copy, DM Sans not installed) and report it to the user rather than letting these silently pass as "done."
