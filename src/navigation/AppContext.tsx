import React, { createContext, useContext } from 'react';
import type { BillingInfo, Recipe, UserPreferences, UserProfile } from '../types';

export interface AppContextValue {
  preferences: UserPreferences;
  setPreferences: (value: UserPreferences) => void;
  userProfile: UserProfile;
  setUserProfile: (value: UserProfile) => void;
  billing: BillingInfo;
  setBilling: (value: BillingInfo) => void;
  saveRecipe: (recipe: Recipe) => Promise<boolean>;
  removeRecipe: (recipeId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppContextProvider({ value, children }: { value: AppContextValue; children: React.ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
}
