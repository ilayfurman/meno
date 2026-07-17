import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth, useClerk } from '@clerk/expo';
import { AuthScreen } from '../screens/AuthScreen';
import { AuthCapabilityProvider } from './AuthCapabilityContext';

// Only rendered when a Clerk Publishable Key is configured (see App.tsx),
// so it's always safe to call Clerk's hooks here — this component only
// exists inside a <ClerkProvider>.
//
// Clerk's tokenCache (see App.tsx, backed by expo-secure-store) persists
// the session on-device, so isSignedIn comes back true on a cold launch
// without the user doing anything — that's what makes "stay signed in
// until you explicitly sign out" work, no extra code needed here beyond
// just rendering `children` once isSignedIn is true. There used to be a
// Face ID re-lock gate between this check and `children`; removed since
// this app doesn't need an additional lock layer on top of the account
// session itself.
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
      {children}
    </AuthCapabilityProvider>
  );
}
