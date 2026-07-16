import React, { useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth, useClerk } from '@clerk/expo';
import { AuthScreen } from '../screens/AuthScreen';
import { AuthCapabilityProvider } from './AuthCapabilityContext';
import { BiometricLockGate } from './BiometricLockGate';

// Only rendered when a Clerk Publishable Key is configured (see App.tsx),
// so it's always safe to call Clerk's hooks here — this component only
// exists inside a <ClerkProvider>.
export function ClerkAuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();

  // Distinguishes "just finished the email code flow, right now, in this
  // app session" from "app launched and Clerk silently restored an old
  // session". Only the latter should ever show the Face ID lock — signing
  // in with email and then immediately being asked for Face ID too would
  // be a redundant second step. Updated directly in the render body (not
  // useEffect) so the flag is correct in the very same render where
  // isSignedIn flips true — an effect would run one tick too late for
  // BiometricLockGate's first render to see it.
  const previousIsSignedIn = useRef<boolean | null>(null);
  const justSignedInRef = useRef(false);
  if (previousIsSignedIn.current === false && isSignedIn === true) {
    justSignedInRef.current = true;
  }
  if (previousIsSignedIn.current !== isSignedIn) {
    previousIsSignedIn.current = isSignedIn ?? null;
  }

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn) {
    return <AuthScreen />;
  }

  return (
    <AuthCapabilityProvider value={{ clerkEnabled: true, signOut: () => clerk.signOut() }}>
      <BiometricLockGate skipInitialLock={justSignedInRef.current}>{children}</BiometricLockGate>
    </AuthCapabilityProvider>
  );
}
