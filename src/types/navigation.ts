export type MainTabParamList = {
  Cookbook: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  RecipeDetail: { recipeId: string };
  EditRecipe: { recipeId: string };
  QuickGenerate: undefined;
  ProfileNotifications: undefined;
  ProfileHelpCenter: undefined;
  ProfileContactUs: undefined;
  ProfileRateMeno: undefined;
  ProfileTerms: undefined;
  ProfilePrivacy: undefined;
  ProfilePlans: undefined;
};
