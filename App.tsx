import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppContextProvider } from './src/navigation/AppContext';
import { defaultPreferences, getPreferences, savePreferences } from './src/storage/preferences';
import { saveRecipeToCookbook } from './src/storage/cookbook';
import type { Recipe, UserPreferences } from './src/types';

export default function App() {
  const [preferences, setPreferencesState] = useState<UserPreferences | null>(null);

  useEffect(() => {
    getPreferences().then(setPreferencesState);
  }, []);

  const setPreferences = (next: UserPreferences) => {
    setPreferencesState(next);
    void savePreferences(next);
  };

  const saveRecipe = async (recipe: Recipe) => {
    await saveRecipeToCookbook(recipe);
  };

  const value = useMemo(
    () => ({
      preferences: preferences ?? defaultPreferences,
      setPreferences,
      saveRecipe,
    }),
    [preferences],
  );

  if (!preferences) {
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
