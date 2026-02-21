import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserPreferences } from '../types';

const PREFS_KEY = 'meno:userPreferences';

export const defaultPreferences: UserPreferences = {
  dietaryRestriction: 'none',
  allergies: [],
  cuisinesLiked: [],
  spiceLevel: 'med',
  onboardingComplete: false,
};

export async function getPreferences(): Promise<UserPreferences> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) {
    return defaultPreferences;
  }

  try {
    return { ...defaultPreferences, ...JSON.parse(raw) } as UserPreferences;
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(preferences: UserPreferences): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
}
