import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BillingInfo, UserProfile } from '../types';

const PROFILE_KEY = 'meno:userProfile';
const BILLING_KEY = 'meno:billing';

export const defaultUserProfile: UserProfile = {
  name: 'Meno User',
  email: 'you@example.com',
};

export const defaultBilling: BillingInfo = {
  plan: 'free',
};

export async function getUserProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return defaultUserProfile;
  }
  try {
    return { ...defaultUserProfile, ...JSON.parse(raw) } as UserProfile;
  } catch {
    return defaultUserProfile;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function getBilling(): Promise<BillingInfo> {
  const raw = await AsyncStorage.getItem(BILLING_KEY);
  if (!raw) {
    return defaultBilling;
  }
  try {
    return { ...defaultBilling, ...JSON.parse(raw) } as BillingInfo;
  } catch {
    return defaultBilling;
  }
}

export async function saveBilling(billing: BillingInfo): Promise<void> {
  await AsyncStorage.setItem(BILLING_KEY, JSON.stringify(billing));
}
