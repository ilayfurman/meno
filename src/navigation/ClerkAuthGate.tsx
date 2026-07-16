import React from 'react';
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
      <BiometricLockGate>{children}</BiometricLockGate>
    </AuthCapabilityProvider>
  );
}
