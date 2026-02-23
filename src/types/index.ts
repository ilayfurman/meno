export const dietaryRestrictionOptions = ['none', 'vegetarian', 'vegan', 'gluten-free', 'kosher', 'halal'] as const;
export type DietaryRestriction = (typeof dietaryRestrictionOptions)[number];

export const allergyOptions = [
  'peanuts',
  'tree nuts',
  'dairy',
  'eggs',
  'soy',
  'wheat',
  'shellfish',
  'fish',
  'sesame',
] as const;
export type Allergy = (typeof allergyOptions)[number];

export const cuisineOptions = [
  'Italian',
  'Mexican',
  'Japanese',
  'Thai',
  'Mediterranean',
  'Indian',
  'Korean',
  'Middle Eastern',
  'American',
] as const;

export const spiceLevelOptions = ['low', 'med', 'high'] as const;
export type SpiceLevel = (typeof spiceLevelOptions)[number];

export interface UserPreferences {
  dietaryRestriction: DietaryRestriction;
  allergies: Allergy[];
  cuisinesLiked: string[];
  spiceLevel: SpiceLevel;
  onboardingComplete: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
}

export type PlanTier = 'free' | 'plus' | 'pro';

export interface BillingInfo {
  plan: PlanTier;
  renewalDate?: string;
}

export const timeOptions = [15, 30, 45] as const;
export type TimeOption = (typeof timeOptions)[number];

export const vibeOptions = ['comfort', 'fresh', 'high-protein', 'impress', 'light'] as const;
export type VibeOption = (typeof vibeOptions)[number];

export const difficultyOptions = ['easy', 'medium'] as const;
export type DifficultyOption = (typeof difficultyOptions)[number];

export interface GenerationRequest {
  time: TimeOption;
  vibe: VibeOption;
  difficulty: DifficultyOption;
}

export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  notes?: string | null;
  quantity_value?: number | null;
  quantity_unit?: string | null;
  quantity_text?: string | null;
}

export interface RecipeStep {
  idx: number;
  text: string;
  timer_seconds?: number | null;
}

export interface RecipeSubstitution {
  ingredient: string;
  substitutes: string[];
  notes: string;
}

export interface Recipe {
  id: string;
  title: string;
  cuisine: string;
  servings: number;
  total_time_minutes: number;
  difficulty: string;
  short_hook: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  substitutions: RecipeSubstitution[];
  dietary_tags: string[];
  allergen_warnings: string[];
  recipe_family_id?: string;
  version_number?: number;
  based_on_recipe_id?: string;
  change_note?: string;
  created_at?: number;
  completion_state?: 'summary' | 'full';
}

export interface RecipeSummary {
  id: string;
  title: string;
  cuisine: string;
  servings_hint: number | null;
  total_time_minutes: number;
  difficulty: string;
  short_hook: string;
  dietary_tags: string[];
  allergen_warnings: string[];
}

export interface GeneratedRecipeRun {
  id: string;
  createdAt: number;
  request: GenerationRequest;
  requestHash: string;
  summaries: RecipeSummary[];
  recipesById: Record<string, Recipe>;
  statusById: Record<string, 'pending' | 'ready' | 'error'>;
  errorsById: Record<string, string>;
  stage: 'summaries_ready' | 'hydrating' | 'done';
}
