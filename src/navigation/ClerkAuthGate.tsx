import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth, useClerk, useUser } from '@clerk/expo';
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
  const { user } = useUser();

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

  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  // fullName is Clerk's own firstName+lastName join; falls back to the email
  // handle (part before @) for accounts created before the name field
  // existed, or that skipped it.
  const name = user?.fullName?.trim() || email.split('@')[0] || 'Meno User';
  const photoUrl = user?.hasImage ? user.imageUrl : null;

  // We store the whole name in firstName (see AuthScreen's sign-up form --
  // there's no separate last-name field), so an edit just overwrites it.
  const updateName = async (nextName: string) => {
    if (!user) return;
    await user.update({ firstName: nextName.trim() });
  };

  // Clerk accepts a base64 data: URL directly as the file, same format the
  // recipe photo picker already produces -- no separate upload step needed.
  const updatePhoto = async (dataUrl: string) => {
    if (!user) return;
    await user.setProfileImage({ file: dataUrl });
  };

  return (
    <AuthCapabilityProvider
      value={{ clerkEnabled: true, signOut: () => clerk.signOut(), name, email, photoUrl, updateName, updatePhoto }}
    >
      {children}
    </AuthCapabilityProvider>
  );
}
