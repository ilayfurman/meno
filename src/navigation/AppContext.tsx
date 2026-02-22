import React, { createContext, useContext } from 'react';
import type { BillingInfo, GeneratedRecipeRun, GenerationRequest, Recipe, UserPreferences, UserProfile } from '../types';

export interface AppContextValue {
  preferences: UserPreferences;
  setPreferences: (value: UserPreferences) => void;
  userProfile: UserProfile;
  setUserProfile: (value: UserProfile) => void;
  billing: BillingInfo;
  setBilling: (value: BillingInfo) => void;
  generatedRuns: GeneratedRecipeRun[];
  addGeneratedRun: (run: GeneratedRecipeRun) => void; // legacy helper during migration
  startGenerationRun: (request: GenerationRequest) => Promise<string>;
  hydrateRun: (runId: string) => Promise<void>;
  cancelRunHydration: (runId: string) => void;
  getRecipeForRun: (runId: string, recipeId: string) => Recipe | null;
  setRunRecipe: (runId: string, recipeId: string, recipe: Recipe) => void;
  setRunRecipeError: (runId: string, recipeId: string, message: string) => void;
  removeGeneratedRun: (runId: string) => void;
  removeRecipeFromGeneratedRun: (runId: string, recipeId: string) => void;
  saveRecipe: (recipe: Recipe) => Promise<boolean>;
  saveRecipeRevision: (params: {
    baseRecipeId: string;
    revisedRecipe: Recipe;
    replaceBase?: boolean;
    changeNote?: string;
  }) => Promise<Recipe>;
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
