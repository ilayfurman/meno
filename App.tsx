import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppContextProvider } from './src/navigation/AppContext';
import { defaultPreferences, getPreferences, savePreferences } from './src/storage/preferences';
import { defaultBilling, defaultUserProfile, getBilling, getUserProfile, saveBilling, saveUserProfile } from './src/storage/account';
import { removeRecipeFromCookbook, saveRecipeRevision as saveRecipeRevisionToCookbook, saveRecipeToCookbook } from './src/storage/cookbook';
import { generateFullRecipeFromSummary, generateRecipeSummaries } from './src/ai/openai';
import type { BillingInfo, GeneratedRecipeRun, GenerationRequest, Recipe, UserPreferences, UserProfile } from './src/types';

export default function App() {
  const [preferences, setPreferencesState] = useState<UserPreferences | null>(null);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [billing, setBillingState] = useState<BillingInfo | null>(null);
  const [generatedRuns, setGeneratedRuns] = useState<GeneratedRecipeRun[]>([]);
  const hydrationTokensRef = React.useRef<Record<string, symbol>>({});
  const fullRecipeCacheRef = React.useRef<Record<string, Recipe>>({});
  const preferencesRef = React.useRef<UserPreferences | null>(null);
  const runsRef = React.useRef<GeneratedRecipeRun[]>([]);
  const pendingRunMapRef = React.useRef<Record<string, GeneratedRecipeRun>>({});

  useEffect(() => {
    Promise.all([getPreferences(), getUserProfile(), getBilling()]).then(([prefs, profile, billingData]) => {
      setPreferencesState(prefs);
      setUserProfileState(profile);
      setBillingState(billingData);
    });
  }, []);

  const setPreferences = (next: UserPreferences) => {
    setPreferencesState(next);
    preferencesRef.current = next;
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

  const saveRecipeRevision = async (params: {
    baseRecipeId: string;
    revisedRecipe: Recipe;
    replaceBase?: boolean;
    changeNote?: string;
  }) => {
    return saveRecipeRevisionToCookbook(params);
  };

  const addGeneratedRun = (run: GeneratedRecipeRun) => {
    setGeneratedRuns((prev) => {
      const withoutDuplicate = prev.filter((item) => item.id !== run.id);
      return [run, ...withoutDuplicate];
    });
  };

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    runsRef.current = generatedRuns;
  }, [generatedRuns]);

  const setRunRecipe = (runId: string, recipeId: string, recipe: Recipe) => {
    setGeneratedRuns((prev) =>
      prev.map((run) => {
        if (run.id !== runId) {
          return run;
        }
        const nextStatus = { ...run.statusById, [recipeId]: 'ready' as const };
        const allDone = Object.values(nextStatus).every((status) => status !== 'pending');
        return {
          ...run,
          recipesById: { ...run.recipesById, [recipeId]: recipe },
          statusById: nextStatus,
          stage: allDone ? 'done' : 'hydrating',
        };
      }),
    );
  };

  const setRunRecipeError = (runId: string, recipeId: string, message: string) => {
    setGeneratedRuns((prev) =>
      prev.map((run) => {
        if (run.id !== runId) {
          return run;
        }
        const nextStatus = { ...run.statusById, [recipeId]: 'error' as const };
        const allDone = Object.values(nextStatus).every((status) => status !== 'pending');
        return {
          ...run,
          statusById: nextStatus,
          errorsById: { ...run.errorsById, [recipeId]: message },
          stage: allDone ? 'done' : 'hydrating',
        };
      }),
    );
  };

  const cancelRunHydration = (runId: string) => {
    hydrationTokensRef.current[runId] = Symbol('cancelled');
  };

  const hydrateRun = async (runId: string) => {
    const token = Symbol(`hydrate:${runId}`);
    hydrationTokensRef.current[runId] = token;
    setGeneratedRuns((prev) => prev.map((run) => (run.id === runId ? { ...run, stage: 'hydrating' } : run)));

    const run = runsRef.current.find((item) => item.id === runId);
    const pendingRun = pendingRunMapRef.current[runId];
    const prefs = preferencesRef.current;
    const targetRun = run ?? pendingRun;
    if (!targetRun || !prefs) {
      return;
    }

    const pendingIds = targetRun.summaries
      .map((summary) => summary.id)
      .filter((recipeId) => targetRun.statusById[recipeId] === 'pending');
    let cursor = 0;
    const concurrency = 2;

    const worker = async () => {
      while (cursor < pendingIds.length) {
        const localIndex = cursor;
        cursor += 1;
        const recipeId = pendingIds[localIndex];
        const latestToken = hydrationTokensRef.current[runId];
        if (latestToken !== token) {
          return;
        }

        const summary = targetRun.summaries.find((item) => item.id === recipeId);
        if (!summary) {
          continue;
        }

        const cacheKey = `${targetRun.requestHash}:${recipeId}`;
        const cached = fullRecipeCacheRef.current[cacheKey];
        if (cached) {
          setRunRecipe(runId, recipeId, cached);
          continue;
        }

        try {
          const fullRecipe = await generateFullRecipeFromSummary({
            preferences: prefs,
            request: targetRun.request,
            summary,
          });
          const normalized = {
            ...fullRecipe,
            id: recipeId,
            completion_state: 'full' as const,
          };
          fullRecipeCacheRef.current[cacheKey] = normalized;
          setRunRecipe(runId, recipeId, normalized);
        } catch (error) {
          setRunRecipeError(runId, recipeId, error instanceof Error ? error.message : 'Failed to hydrate recipe');
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, pendingIds.length) }, () => worker()));
    delete pendingRunMapRef.current[runId];
  };

  const startGenerationRun = async (request: GenerationRequest): Promise<string> => {
    const prefs = preferencesRef.current;
    if (!prefs) {
      throw new Error('Preferences are not loaded yet.');
    }

    const summaries = await generateRecipeSummaries({
      preferences: prefs,
      request,
      count: 3,
    });

    const now = Date.now();
    const runId = `${now}`;
    const requestHash = JSON.stringify({
      request,
      dietaryRestriction: prefs.dietaryRestriction,
      allergies: prefs.allergies,
      cuisinesLiked: prefs.cuisinesLiked,
      spiceLevel: prefs.spiceLevel,
    });
    const statusById = Object.fromEntries(summaries.map((summary) => [summary.id, 'pending'])) as GeneratedRecipeRun['statusById'];

    const run: GeneratedRecipeRun = {
      id: runId,
      createdAt: now,
      request,
      requestHash,
      summaries,
      recipesById: {},
      statusById,
      errorsById: {},
      stage: 'summaries_ready',
    };

    pendingRunMapRef.current[runId] = run;
    addGeneratedRun(run);
    return runId;
  };

  const getRecipeForRun = (runId: string, recipeId: string): Recipe | null => {
    const run = runsRef.current.find((item) => item.id === runId);
    if (!run) {
      return null;
    }
    return run.recipesById[recipeId] ?? null;
  };

  const removeGeneratedRun = (runId: string) => {
    cancelRunHydration(runId);
    delete pendingRunMapRef.current[runId];
    setGeneratedRuns((prev) => prev.filter((item) => item.id !== runId));
  };

  const removeRecipeFromGeneratedRun = (runId: string, recipeId: string) => {
    setGeneratedRuns((prev) =>
      prev
        .map((run) => {
          if (run.id !== runId) {
            return run;
          }
          const { [recipeId]: _, ...nextStatus } = run.statusById;
          const { [recipeId]: __, ...nextRecipes } = run.recipesById;
          const { [recipeId]: ___, ...nextErrors } = run.errorsById;
          const nextSummaries = run.summaries.filter((summary) => summary.id !== recipeId);
          return {
            ...run,
            summaries: nextSummaries,
            statusById: nextStatus,
            recipesById: nextRecipes,
            errorsById: nextErrors,
          };
        })
        .filter((run) => run.summaries.length > 0),
    );
  };

  const value = useMemo(
    () => ({
      preferences: preferences ?? defaultPreferences,
      setPreferences,
      userProfile: userProfile ?? defaultUserProfile,
      setUserProfile,
      billing: billing ?? defaultBilling,
      setBilling,
      generatedRuns,
      addGeneratedRun,
      startGenerationRun,
      hydrateRun,
      cancelRunHydration,
      getRecipeForRun,
      setRunRecipe,
      setRunRecipeError,
      removeGeneratedRun,
      removeRecipeFromGeneratedRun,
      saveRecipe,
      saveRecipeRevision,
      removeRecipe,
    }),
    [preferences, userProfile, billing, generatedRuns],
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
