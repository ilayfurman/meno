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
}

const defaultValue: AuthCapabilityValue = { clerkEnabled: false, signOut: null };

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
