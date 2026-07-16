import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSignIn, useSignUp } from '@clerk/expo';
import { PressableScale } from '../components/PressableScale';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';

type Mode = 'signup' | 'signin';

// Shown whenever EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is set and there's no
// active session — see the ClerkAuthGate in App.tsx. Both hooks stay mounted
// together so switching the segmented toggle doesn't lose in-progress state.
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signup');
  const signUpFlow = useSignUp();
  const signInFlow = useSignIn();

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Welcome to Meno</Text>
        <Text style={styles.subtitle}>
          {mode === 'signup' ? 'Create an account to save your cookbook' : 'Sign in to sync your cookbook'}
        </Text>

        <View style={styles.modeTrack}>
          <PressableScale onPress={() => setMode('signup')} style={styles.modeItem}>
            <View style={[styles.modeOption, mode === 'signup' && styles.modeOptionActive]}>
              <Text style={[styles.modeLabel, mode === 'signup' && styles.modeLabelActive]}>Create account</Text>
            </View>
          </PressableScale>
          <PressableScale onPress={() => setMode('signin')} style={styles.modeItem}>
            <View style={[styles.modeOption, mode === 'signin' && styles.modeOptionActive]}>
              <Text style={[styles.modeLabel, mode === 'signin' && styles.modeLabelActive]}>Sign in</Text>
            </View>
          </PressableScale>
        </View>

        <View style={styles.card}>
          {mode === 'signup' ? <SignUpCard flow={signUpFlow} /> : <SignInCard flow={signInFlow} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type SignUpFlow = ReturnType<typeof useSignUp>;
type SignInFlow = ReturnType<typeof useSignIn>;

function SignUpCard({ flow }: { flow: SignUpFlow }) {
  const { signUp, errors, fetchStatus } = flow;
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);
  const isFetching = fetchStatus === 'fetching';

  const handleSubmit = async () => {
    setGeneralError(null);
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      setGeneralError(error.message ?? 'Something went wrong. Please try again.');
      return;
    }
    if (signUp.status === 'missing_requirements' && signUp.unverifiedFields.includes('email_address')) {
      await signUp.verifications.sendEmailCode();
    }
  };

  const handleVerify = async () => {
    setGeneralError(null);
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === 'complete') {
      // Finalize activates the session — our top-level auth gate reacts to
      // isSignedIn on its own, so there's nothing for us to navigate to here.
      await signUp.finalize({ navigate: () => {} });
    } else {
      setGeneralError('That code didn’t work — check it and try again.');
    }
  };

  const awaitingCode =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  if (awaitingCode) {
    return (
      <>
        <Text style={styles.cardTitle}>Check your email</Text>
        <Text style={styles.cardSubtitle}>Enter the code we just sent to {emailAddress}</Text>

        <Text style={styles.label}>Verification code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          style={styles.input}
        />
        {errors.fields.code ? <Text style={styles.errorText}>{errors.fields.code.message}</Text> : null}
        {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

        <PressableScale onPress={handleVerify} style={styles.primaryButton}>
          {isFetching ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify</Text>}
        </PressableScale>
        <PressableScale onPress={() => signUp.verifications.sendEmailCode()} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>Resend code</Text>
        </PressableScale>
      </>
    );
  }

  return (
    <>
      <Text style={styles.label}>Email address</Text>
      <TextInput
        value={emailAddress}
        onChangeText={setEmailAddress}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      {errors.fields.emailAddress ? <Text style={styles.errorText}>{errors.fields.emailAddress.message}</Text> : null}

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        style={styles.input}
      />
      {errors.fields.password ? <Text style={styles.errorText}>{errors.fields.password.message}</Text> : null}
      {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

      <PressableScale
        onPress={handleSubmit}
        style={[styles.primaryButton, (!emailAddress || !password || isFetching) && styles.primaryButtonDisabled]}
      >
        {isFetching ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create account</Text>}
      </PressableScale>

      {/* Required by Clerk's bot sign-up protection when enabled in the dashboard. */}
      <View nativeID="clerk-captcha" />
    </>
  );
}

function SignInCard({ flow }: { flow: SignInFlow }) {
  const { signIn, errors, fetchStatus } = flow;
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const isFetching = fetchStatus === 'fetching';

  const handleSubmit = async () => {
    setGeneralError(null);
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      setGeneralError(error.message ?? 'Something went wrong. Please try again.');
      return;
    }

    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => {} });
    } else if (signIn.status === 'needs_client_trust') {
      const emailCodeFactor = signIn.supportedSecondFactors?.find((factor) => factor.strategy === 'email_code');
      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
        setNeedsCode(true);
      } else {
        setGeneralError('This account needs additional verification we don’t support yet.');
      }
    } else {
      setGeneralError('Sign-in needs an extra step we don’t support yet.');
    }
  };

  const handleVerify = async () => {
    setGeneralError(null);
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => {} });
    } else {
      setGeneralError('That code didn’t work — check it and try again.');
    }
  };

  if (needsCode) {
    return (
      <>
        <Text style={styles.cardTitle}>Verify it’s you</Text>
        <Text style={styles.cardSubtitle}>Enter the code we just sent to {emailAddress}</Text>

        <Text style={styles.label}>Verification code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          style={styles.input}
        />
        {errors.fields.code ? <Text style={styles.errorText}>{errors.fields.code.message}</Text> : null}
        {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

        <PressableScale onPress={handleVerify} style={styles.primaryButton}>
          {isFetching ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify</Text>}
        </PressableScale>
        <PressableScale
          onPress={() => {
            signIn.reset();
            setNeedsCode(false);
          }}
          style={styles.ghostButton}
        >
          <Text style={styles.ghostButtonText}>Start over</Text>
        </PressableScale>
      </>
    );
  }

  return (
    <>
      <Text style={styles.label}>Email address</Text>
      <TextInput
        value={emailAddress}
        onChangeText={setEmailAddress}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      {errors.fields.identifier ? <Text style={styles.errorText}>{errors.fields.identifier.message}</Text> : null}

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        style={styles.input}
      />
      {errors.fields.password ? <Text style={styles.errorText}>{errors.fields.password.message}</Text> : null}
      {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

      <PressableScale
        onPress={handleSubmit}
        style={[styles.primaryButton, (!emailAddress || !password || isFetching) && styles.primaryButtonDisabled]}
      >
        {isFetching ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
      </PressableScale>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 40,
  },
  title: {
    fontFamily: fontFamily.extraBold,
    color: colors.foreground,
    fontSize: 28,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.subtext,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  modeTrack: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    ...elevation.card,
  },
  modeItem: {
    flex: 1,
  },
  modeOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  modeOptionActive: {
    backgroundColor: colors.foreground,
  },
  modeLabel: {
    color: colors.subtext,
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
  },
  modeLabelActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: spacing.radiusCard,
    padding: 20,
    ...elevation.raised,
  },
  cardTitle: {
    fontFamily: fontFamily.extraBold,
    color: colors.foreground,
    fontSize: 18,
  },
  cardSubtitle: {
    color: colors.subtext,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  label: {
    color: colors.subtext,
    fontSize: 11,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.canvas,
    borderRadius: spacing.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    color: colors.foreground,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12.5,
    marginTop: 6,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 14,
    marginTop: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 15,
  },
  ghostButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  ghostButtonText: {
    color: colors.subtext,
    fontFamily: fontFamily.bold,
    fontSize: 13,
  },
});
