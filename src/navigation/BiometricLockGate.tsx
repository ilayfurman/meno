import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { BiometricLockScreen } from '../screens/BiometricLockScreen';
import { getFaceIdLockEnabled } from '../storage/security';
import { useAuthCapability } from './AuthCapabilityContext';

// Only meaningful once Clerk has an active session (mounted inside
// ClerkAuthGate's isSignedIn branch) -- this doesn't touch auth itself,
// it just gates *rendering* of the already-authenticated app behind a
// local Face ID check on this device. Off by default; see the Face ID
// Lock toggle on the Profile screen.
export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuthCapability();
  const [loaded, setLoaded] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    void getFaceIdLockEnabled().then((enabled) => {
      setLockEnabled(enabled);
      setUnlocked(!enabled);
      setLoaded(true);
    });
  }, []);

  // Re-lock whenever the app comes back from the background, mirroring
  // Rocket Money's behavior -- not just on cold start.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active' && lockEnabled) {
        setUnlocked(false);
      }
      appState.current = next;
    });
    return () => subscription.remove();
  }, [lockEnabled]);

  if (!loaded) {
    return null;
  }

  if (lockEnabled && !unlocked) {
    return (
      <BiometricLockScreen
        onUnlock={() => setUnlocked(true)}
        onLogOut={() => {
          void signOut?.();
        }}
      />
    );
  }

  return <>{children}</>;
}
