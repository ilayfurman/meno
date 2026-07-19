import React, { createContext, useContext } from 'react';

interface AuthCapabilityValue {
  // False whenever EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY isn't set — the app is
  // still running under the local dev-auth fallback in that case.
  clerkEnabled: boolean;
  // Null under dev-auth (nothing real to sign out of). Screens should guard
  // with `signOut?.()` rather than assuming it's always present — this lets
  // the same ProfileScreen code work whether or not Clerk is configured,
  // without ever calling a Clerk hook outside of a ClerkProvider.
  signOut: (() => Promise<void>) | null;
  // Display identity for screens like Profile. Under Clerk, this is the real
  // signed-in user's name/email (computed in ClerkAuthGate, where it's safe
  // to call Clerk hooks). Under dev-auth, this is the local placeholder
  // profile from storage, so the UI reads the same either way.
  name: string;
  email: string;
  // Null when no avatar has been set yet (Clerk's default generated avatar
  // still counts as "set" under Clerk -- this is only null in the pure
  // dev-auth, never-picked-a-photo case).
  photoUrl: string | null;
  // Both resolve once the update has actually taken effect -- under Clerk
  // that means the API call finished; under dev-auth, that local storage
  // was written. Screens can await these to know when it's safe to close an
  // edit sheet.
  updateName: (name: string) => Promise<void>;
  updatePhoto: (dataUrl: string) => Promise<void>;
}

const noop = async () => {};

const defaultValue: AuthCapabilityValue = {
  clerkEnabled: false,
  signOut: null,
  name: 'Meno User',
  email: 'you@example.com',
  photoUrl: null,
  updateName: noop,
  updatePhoto: noop,
};

const AuthCapabilityContext = createContext<AuthCapabilityValue>(defaultValue);

export function AuthCapabilityProvider({
  value,
  children,
}: {
  value: AuthCapabilityValue;
  children: React.ReactNode;
}) {
  return <AuthCapabilityContext.Provider value={value}>{children}</AuthCapabilityContext.Provider>;
}

export function useAuthCapability(): AuthCapabilityValue {
  return useContext(AuthCapabilityContext);
}
