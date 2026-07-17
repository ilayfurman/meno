# Meno Cookbook Redesign — Backend & Platform Design

## Overview

Meno pivots from "AI generates recipes in-app" to "your cookbook is the product" — a browsable, versioned recipe library, redesigned per `design_handoff_meno_cookbook_redesign/`. This spec covers the **backend and platform decisions** needed to support that redesign. UI screen behavior is already fully specified in `design_handoff_meno_cookbook_redesign/README.md` and is treated as ground truth for the frontend plan(s) that follow this one.

**Decision: modify, not rewrite.** The existing backend (Fastify + Drizzle + Postgres + Clerk) is extended, not replaced. The frontend (Expo + React Native + TypeScript) is kept as the framework, but most screens are rebuilt to match the new design. Native capabilities required by the design (share extension, native share sheet, file picker, PDF export) require moving off Expo Go to an EAS Dev Client.

## Platform Decision: Keep Custom Backend, Do Not Adopt Supabase

Supabase's core value is letting a client talk directly to Postgres via Row Level Security, replacing a hand-written API layer. Meno's writes are never simple inserts — recipe import requires an LLM call to structure text/PDF/link content, saving an iteration requires versioning logic, and any future MCP integration requires a server mediating third-party access. A real API server was always required, so Supabase's headline benefit doesn't apply. Object storage for recipe photos can be added independently of this decision (Cloudflare R2 recommended for cost) without adopting Supabase as a platform.

**Conclusion:** keep Fastify + Drizzle + Postgres (Neon) + Clerk. Extend schema and routes.

## Data Model Changes

### Versioning — linear history per recipe, no branching

A recipe has one ordered, linear version history. Each version has its own ingredients, steps, and a short change note. Exactly one version is marked as the recipe's current/default (what shows on the Cookbook card and opens by default in Recipe Detail). Switching "current version" is a pointer update, not a data copy. There is no branching/forking within a recipe family — a genuinely different variant is a new recipe, not a version.

New tables:
- `recipe_versions`: `id`, `recipe_id` (FK → `recipes`), `version_number` (int, unique per recipe), `ingredients` (jsonb), `steps` (jsonb), `change_note` (text, nullable), `created_at`.
- `recipes` gains `current_version_id` (FK → `recipe_versions`, nullable until first version exists) and drops the flat `ingredients`/`steps`/`substitutions` columns (moved to `recipe_versions`). `substitutions` is dropped entirely — not part of the new design's data model (the old Quick-Generate-era "swap ingredient" flow is being replaced by re-importing/re-editing a version).

### Delete semantics — two distinct operations

- **Delete a version**: removes one `recipe_versions` row. If it was `current_version_id`, `current_version_id` is reassigned to the next-most-recent remaining version by `version_number`. A recipe must always have at least one version — deleting the last remaining version deletes the recipe itself (falls through to the recipe-delete path below).
- **Delete a recipe**: removes the `recipes` row and cascades to all its `recipe_versions` and its `cookbook_items` row. One user action, one confirmation, whole family gone.

### New fields

- `recipes`: `video_url` (text, nullable), `video_platform` (varchar, nullable — `'tiktok' | 'instagram' | 'youtube' | 'other'`, derived server-side from `video_url`'s hostname at write time, not guessed client-side).
- `recipes.source_type` extends beyond the current `'generated'` default to also accept `'link' | 'pdf' | 'text'`, matching the three import segments in the new "Add a recipe" sheet.
- `cookbook_items` gains `is_favorite` (boolean, default false) — favoriting is per-user-per-recipe, which is exactly what `cookbook_items` already models (favoriting isn't a property of the recipe itself, since recipes can in principle be shared/viewed read-only by non-owners later).
- `users` gains a `user_preferences` sibling table (1:1): `diet` (text, nullable — one of Vegetarian/Vegan/Pescatarian/Omnivore), `avoid` (jsonb string array — subset of No Nuts/No Dairy/No Gluten/No Shellfish), `notify_recipe_saved` (boolean, default true), `notify_weekly_digest` (boolean, default false), `notify_product_updates` (boolean, default false). Separate table rather than columns on `users` so the auth/user-resolution path in `plugins/auth.ts` stays untouched.
- `users` gains `plan` (varchar, default `'free'`) for the Free/Meno Plus distinction shown in Profile. Billing enforcement (StoreKit/RevenueCat wiring) is explicitly out of scope for this plan — the column exists so Profile can render plan state, but no purchase flow is implemented here.

## MCP — Deferred, Schema Stays Ready

Not built in this pass. Two structural decisions now avoid a rewrite later: (1) `users.id` remains the stable internal identity that any future MCP OAuth token resolves to — nothing else needs to change when MCP is added; (2) recipe read/write logic must live in `backend/src/services/recipes.ts`-style service functions callable by both REST routes and a future MCP tool handler, never embedded directly in Fastify route handlers.

The "Connect" tab from the design doc is **not included in v1** — the tab bar ships with 2 items (Cookbook, Profile) instead of 3. Connect is re-added as a tab when MCP is actually built.

## Tooling: Expo Go → EAS Dev Client

Expo Go is a generic, pre-built app with a fixed set of native modules — it cannot include custom native code. The redesign requires native capabilities Expo Go cannot provide: registering Meno as an iOS/Android share-sheet target, invoking the native share sheet (`UIActivityViewController` / Android `ACTION_SEND`), a native file picker for PDF import, and native PDF generation for the Share-as-PDF flow.

**Change:** add `expo-dev-client`, build a custom development client via EAS (`eas build --profile development --platform ios` and `--platform android`), and use that installed app in place of Expo Go for local development going forward. Day-to-day workflow (`npx expo start`, live reload) is unchanged; a new EAS development build is only needed when a new native module/config is added, not on every code change. Both iOS and Android are supported — share-target registration is platform-specific config on each side (iOS share extension entitlement vs. Android intent filter) and must be added separately per platform.

## Out of Scope for This Plan

- Frontend screen implementation (separate plan(s), driven directly by `design_handoff_meno_cookbook_redesign/README.md`).
- MCP server / OAuth authorization server.
- Billing/purchase flow (StoreKit/RevenueCat integration).
- Object storage wiring for recipe photos (flagged as needed, not implemented here — no photo upload flow exists in the current app to hang it off yet; add when the frontend plan reaches photo upload).
