export type MainTabParamList = {
  Cookbook: undefined;
  Profile: undefined;
};

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
