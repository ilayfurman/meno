import AsyncStorage from '@react-native-async-storage/async-storage';

// Purely a local, per-device setting -- unlike UserPreferences this never
// goes through the backend. Whether this phone re-locks with Face ID has
// nothing to do with the account itself.
const FACE_ID_LOCK_KEY = 'meno:faceIdLockEnabled';

export async function getFaceIdLockEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(FACE_ID_LOCK_KEY);
  return raw === 'true';
}

export async function setFaceIdLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(FACE_ID_LOCK_KEY, enabled ? 'true' : 'false');
}
