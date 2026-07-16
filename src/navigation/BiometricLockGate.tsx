import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { BiometricLockScreen } from '../screens/BiometricLockScreen';
import { getFaceIdLockEnabled } from '../storage/security';
import { useAuthCapability } from './AuthCapabilityContext';

interface BiometricLockGateProps {
  children: React.ReactNode;
  // True when the user just completed the email code flow in this same
  // app session (see ClerkAuthGate) -- in that case we skip the lock once,
  // even if Face ID Lock is on, so sign-in is never a two-step "email then
  // also Face ID" flow. It's still enforced normally on the next cold
  // launch or background/resume.
  skipInitialLock?: boolean;
}

// Only meaningful once Clerk has an active session (mounted inside
// ClerkAuthGate's isSignedIn branch) -- this doesn't touch auth itself,
// it just gates *rendering* of the already-authenticated app behind a
// local Face ID check on this device. Off by default; see the Face ID
// Lock toggle on the Profile screen.
export function BiometricLockGate({ children, skipInitialLock }: BiometricLockGateProps) {
  const { signOut } = useAuthCapability();
  const [loaded, setLoaded] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    void getFaceIdLockEnabled().then((enabled) => {
      setLockEnabled(enabled);
      setUnlocked(!enabled || Boolean(skipInitialLock));
      setLoaded(true);
    });
    // Only meant to run once per mount (right after a fresh sign-in) --
    // skipInitialLock intentionally isn't a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-lock whenever the app comes back from the background, mirroring
  // Rocket Money's behavior -- not just on cold start.
  //
  // Only 'background' counts as "the user actually left the app" (home
  // button, app switcher, etc). 'inactive' is iOS's transient state for
  // system UI overlaying the app WITHOUT backgrounding it -- and that's
  // exactly what the Face ID / passcode prompt itself triggers (active ->
  // inactive -> active), even on a successful unlock. Treating 'inactive'
  // the same as 'background' here re-locked the app immediately after every
  // unlock, since the prompt's own transition looked identical to
  // backgrounding -- an infinite auth-prompt loop.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current === 'background' && next === 'active' && lockEnabled) {
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
