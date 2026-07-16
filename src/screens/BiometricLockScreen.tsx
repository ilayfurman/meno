import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import { PressableScale } from '../components/PressableScale';
import { fontFamily } from '../theme/fonts';

interface BiometricLockScreenProps {
  onUnlock: () => void;
  onLogOut: () => void;
}

// Rocket-Money-style "welcome back" lock: shown in front of an already
// signed-in session (see BiometricLockGate) rather than being part of
// Clerk's own sign-in flow. Full-bleed brand gradient instead of the
// neutral canvas the rest of the app uses -- this screen is meant to feel
// like a distinct checkpoint, not just another page.
export function BiometricLockScreen({ onUnlock, onLogOut }: BiometricLockScreenProps) {
  const insets = useSafeAreaInsets();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promptUnlock = async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Meno',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        onUnlock();
      } else if (result.error !== 'user_cancel' && result.error !== 'app_cancel') {
        setError('Could not verify — try again.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Prompt automatically as soon as the lock appears, same as Rocket
  // Money — the buttons below are the fallback for when Face ID doesn't
  // fire on its own (cancelled, no biometrics enrolled, etc.).
  useEffect(() => {
    void promptUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.fill}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#e08a5f', '#c1552f', '#6e2f16']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.brandBlock}>
            <View style={styles.mark}>
              <Text style={styles.markText}>M</Text>
            </View>
            <Text style={styles.wordmark}>Meno</Text>
            <Text style={styles.tagline}>Welcome back</Text>
          </View>

          <View style={styles.actions}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <PressableScale onPress={promptUnlock} style={styles.primaryButton}>
              {isAuthenticating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue with Face ID</Text>
              )}
            </PressableScale>
            <PressableScale onPress={onLogOut} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Log out</Text>
            </PressableScale>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  brandBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  markText: {
    color: '#fff',
    fontFamily: fontFamily.extraBold,
    fontSize: 28,
  },
  wordmark: {
    color: '#fff',
    fontFamily: fontFamily.extraBold,
    fontSize: 26,
    letterSpacing: -0.4,
  },
  tagline: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    marginTop: 2,
  },
  actions: {
    gap: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 12.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 999,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 15.5,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fontFamily.bold,
    fontSize: 15,
  },
});
