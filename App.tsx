import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppContextProvider } from './src/navigation/AppContext';
import { defaultPreferences, getPreferences, savePreferences } from './src/storage/preferences';
import { defaultBilling, defaultUserProfile, getBilling, getUserProfile, saveBilling, saveUserProfile } from './src/storage/account';
import { removeRecipeFromCookbook, saveRecipeToCookbook } from './src/storage/cookbook';
import type { BillingInfo, Recipe, UserPreferences, UserProfile } from './src/types';

export default function App() {
  const [preferences, setPreferencesState] = useState<UserPreferences | null>(null);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [billing, setBillingState] = useState<BillingInfo | null>(null);

  useEffect(() => {
    Promise.all([getPreferences(), getUserProfile(), getBilling()]).then(([prefs, profile, billingData]) => {
      setPreferencesState(prefs);
      setUserProfileState(profile);
      setBillingState(billingData);
    });
  }, []);

  const setPreferences = (next: UserPreferences) => {
    setPreferencesState(next);
    void savePreferences(next);
  };

  const setUserProfile = (next: UserProfile) => {
    setUserProfileState(next);
    void saveUserProfile(next);
  };

  const setBilling = (next: BillingInfo) => {
    setBillingState(next);
    void saveBilling(next);
  };

  const saveRecipe = async (recipe: Recipe) => {
    return saveRecipeToCookbook(recipe);
  };

  const removeRecipe = async (recipeId: string) => {
    await removeRecipeFromCookbook(recipeId);
  };

  const value = useMemo(
    () => ({
      preferences: preferences ?? defaultPreferences,
      setPreferences,
      userProfile: userProfile ?? defaultUserProfile,
      setUserProfile,
      billing: billing ?? defaultBilling,
      setBilling,
      saveRecipe,
      removeRecipe,
    }),
    [preferences, userProfile, billing],
  );

  if (!preferences || !userProfile || !billing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AppContextProvider value={value}>
      <StatusBar style="dark" />
      <AppNavigator onboardingComplete={preferences.onboardingComplete} />
    </AppContextProvider>
  );
}
