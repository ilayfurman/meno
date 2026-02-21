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
  notes?: string;
}

export interface RecipeStep {
  idx: number;
  text: string;
  timer_seconds?: number;
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
}
