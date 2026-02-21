import type { GenerationRequest, Recipe } from './index';

export type RootStackParamList = {
  OnboardingDiet: undefined;
  OnboardingAllergies: undefined;
  OnboardingPrefs: undefined;
  Home: undefined;
  Results: { recipes: Recipe[]; requestId: string; request: GenerationRequest };
  RecipeDetail: {
    recipe: Recipe;
    requestId: string;
    request: GenerationRequest;
    listIndex?: number;
  };
  Cookbook: undefined;
};
