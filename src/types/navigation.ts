import type { GenerationRequest, Recipe } from './index';

export type MainTabParamList = {
  Tonight: undefined;
  Cookbook: undefined;
  Explore: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  OnboardingDiet: undefined;
  OnboardingAllergies: undefined;
  OnboardingPrefs: undefined;
  MainTabs: undefined;
  Results: { recipes: Recipe[]; requestId: string; request: GenerationRequest };
  RecipeDetail: {
    recipe: Recipe;
    requestId: string;
    request: GenerationRequest;
    listIndex?: number;
  };
  Account: undefined;
  FoodPreferences: undefined;
  Billing: undefined;
  Support: undefined;
};
