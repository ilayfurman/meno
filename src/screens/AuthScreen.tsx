import React, { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignIn, useSignUp } from '@clerk/expo';
import { PressableScale } from '../components/PressableScale';
import { CodeInput } from '../components/CodeInput';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';

type Stage = 'welcome' | 'signup' | 'signin';

// Shown whenever EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is set and there's no
// active session — see the ClerkAuthGate in App.tsx. Three linear stages
// (Rocket Money's flow, trimmed for a low-stakes app): a welcome/landing
// page with two CTAs, then a dedicated email screen for whichever one was
// tapped, then the code step. Both hooks stay mounted the whole time so
// switching stages never loses in-progress state.
export function AuthScreen() {
  const [stage, setStage] = useState<Stage>('welcome');
  const signUpFlow = useSignUp();
  const signInFlow = useSignIn();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      {/* Two soft, oversized color washes behind everything — purely
          decorative, gives the canvas some warmth instead of flat gray. */}
      <View pointerEvents="none" style={styles.blobTopRight} />
      <View pointerEvents="none" style={styles.blobBottomLeft} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24) + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          {stage === 'welcome' ? (
            <WelcomeStage onCreateAccount={() => setStage('signup')} onLogin={() => setStage('signin')} />
          ) : (
            <>
              {/* PressableScale forwards `style` to its inner Animated.View,
                  not the outer Pressable — alignSelf:'flex-start' has to live
                  on a plain wrapping View, or the tap target stretches to the
                  full row width even though only the circle is visible. */}
              <View style={styles.backButtonWrap}>
                <PressableScale onPress={() => setStage('welcome')} style={styles.backButton}>
                  <Text style={styles.backButtonText}>←</Text>
                </PressableScale>
              </View>
              <View style={styles.card}>
                {stage === 'signup' ? <SignUpCard flow={signUpFlow} /> : <SignInCard flow={signInFlow} />}
              </View>
              <Text style={styles.footerText}>No passwords — we email you a one-time code instead.</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Landing page: wordmark + tagline up top (reserved space below for the
// hero screenshot/illustration once it exists), two CTAs pinned toward the
// bottom — "Create account" as the primary action, "Log in" as the
// secondary one for people who already have an account.
function WelcomeStage({ onCreateAccount, onLogin }: { onCreateAccount: () => void; onLogin: () => void }) {
  return (
    <View style={styles.welcomeWrap}>
      <View style={styles.welcomeHero}>
        <Image source={require('../../assets/wordmark.png')} style={styles.wordmarkImage} resizeMode="contain" />
        <Text style={styles.welcomeTagline}>Save, organize, and cook smarter.</Text>
      </View>

      <View style={styles.welcomeActions}>
        <PressableScale onPress={onCreateAccount} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Create account</Text>
        </PressableScale>
        <PressableScale onPress={onLogin} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkTextBold}>Log in</Text>
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

type SignUpFlow = ReturnType<typeof useSignUp>;
type SignInFlow = ReturnType<typeof useSignIn>;

// Passwordless everywhere: enter your email, we send a 6-digit code, you
// type it in. No password to set/forget/reset, no "click this link to
// activate" email round-trip.
function SignUpCard({ flow }: { flow: SignUpFlow }) {
  const { signUp, errors, fetchStatus } = flow;
  const [emailAddress, setEmailAddress] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [code, setCode] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const isFetching = fetchStatus === 'fetching';

  const handleSubmit = async () => {
    setGeneralError(null);
    const { error } = await signUp.create({ emailAddress });
    if (error) {
      setGeneralError(error.message ?? 'Something went wrong. Please try again.');
      return;
    }
    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: () => {} });
      return;
    }
    const { error: codeError } = await signUp.verifications.sendEmailCode();
    if (codeError) {
      setGeneralError(codeError.message ?? 'Could not send a code. Please try again.');
      return;
    }
    setCode('');
    setAwaitingCode(true);
  };

  const handleVerify = async () => {
    setGeneralError(null);
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setGeneralError(error.message ?? 'That code didn’t work — check it and try again.');
      return;
    }
    // Don't gate on signUp.status here -- reading it synchronously right
    // after this await was returning a stale pre-verification snapshot
    // (verifyEmailCode succeeds with no error, but the local `signUp`
    // reference hadn't caught up yet), which made real successes look like
    // failures. finalize() is the actual authority on whether the sign-up
    // is ready to become a session, so just let it decide.
    const { error: finalizeError } = await signUp.finalize({ navigate: () => {} });
    if (finalizeError) {
      setGeneralError(finalizeError.message ?? 'That code didn’t work — check it and try again.');
    }
    // Finalize activates the session — our top-level auth gate reacts to
    // isSignedIn on its own, so there's nothing for us to navigate to here.
  };

  if (awaitingCode) {
    return (
      <>
        <View style={styles.envelopeBadge}>
          <Text style={styles.envelopeBadgeText}>✉</Text>
        </View>
        <Text style={styles.cardTitle}>Check your email</Text>
        <Text style={styles.cardSubtitle}>Enter the code we just sent to{'\n'}{emailAddress}</Text>

        <CodeInput value={code} onChangeText={setCode} autoFocus />
        {errors.fields.code ? <Text style={styles.errorText}>{errors.fields.code.message}</Text> : null}
        {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

        <PressableScale
          onPress={handleVerify}
          style={[styles.primaryButtonInCard, (code.length < 6 || isFetching) && styles.primaryButtonDisabled]}
        >
          {isFetching ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify  →</Text>}
        </PressableScale>
        <PressableScale onPress={() => setAwaitingCode(false)} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>Change email</Text>
        </PressableScale>
        <PressableScale onPress={() => signUp.verifications.sendEmailCode()} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>Resend code</Text>
        </PressableScale>
      </>
    );
  }

  return (
    <>
      <Text style={styles.pageTitle}>Create account</Text>
      <Text style={styles.pageSubtitle}>Save recipes and sync your cookbook across devices.</Text>

      <TextInput
        value={emailAddress}
        onChangeText={setEmailAddress}
        onFocus={() => setEmailFocused(true)}
        onBlur={() => setEmailFocused(false)}
        placeholder="Email address"
        placeholderTextColor={colors.subtext}
        autoCapitalize="none"
        keyboardType="email-address"
        style={[styles.input, emailFocused && styles.inputFocused]}
      />
      {errors.fields.emailAddress ? <Text style={styles.errorText}>{errors.fields.emailAddress.message}</Text> : null}
      {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

      <PressableScale
        onPress={handleSubmit}
        style={[styles.primaryButtonInCard, (!emailAddress || isFetching) && styles.primaryButtonDisabled]}
      >
        {isFetching ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send code  →</Text>}
      </PressableScale>

      {/* Required by Clerk's bot sign-up protection when enabled in the dashboard. */}
      <View nativeID="clerk-captcha" />
    </>
  );
}

function SignInCard({ flow }: { flow: SignInFlow }) {
  const { signIn, errors, fetchStatus } = flow;
  const [emailAddress, setEmailAddress] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [code, setCode] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);
  // 'verify' is the normal first-factor email code; 'trust' is the rarer
  // second code Clerk asks for on an unrecognized device (client trust).
  const [stage, setStage] = useState<'identify' | 'verify' | 'trust'>('identify');
  const isFetching = fetchStatus === 'fetching';

  const handleSendCode = async () => {
    setGeneralError(null);
    const { error } = await signIn.emailCode.sendCode({ emailAddress });
    if (error) {
      setGeneralError(error.message ?? 'Something went wrong. Please try again.');
      return;
    }
    setCode('');
    setStage('verify');
  };

  const handleVerifyCode = async () => {
    setGeneralError(null);
    const { error } = await signIn.emailCode.verifyCode({ code });
    if (error) {
      setGeneralError(error.message ?? 'That code didn’t work — check it and try again.');
      return;
    }

    // Try finalize optimistically first rather than gating on signIn.status
    // -- reading it synchronously right after verifyCode() can return a
    // stale pre-verification snapshot, which made real successes look like
    // failures. If sign-in genuinely isn't ready yet (e.g. this account
    // needs the rarer "new device" trust check), finalize fails and
    // signIn.status will have had a chance to catch up by then.
    const { error: finalizeError } = await signIn.finalize({ navigate: () => {} });
    if (!finalizeError) {
      return;
    }

    if (signIn.status === 'needs_client_trust') {
      const emailCodeFactor = signIn.supportedSecondFactors?.find((factor) => factor.strategy === 'email_code');
      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
        setCode('');
        setStage('trust');
        return;
      }
      setGeneralError('This account needs additional verification we don’t support yet.');
      return;
    }

    setGeneralError(finalizeError.message ?? 'Sign-in needs an extra step we don’t support yet.');
  };

  const handleVerifyTrust = async () => {
    setGeneralError(null);
    const { error } = await signIn.mfa.verifyEmailCode({ code });
    if (error) {
      setGeneralError(error.message ?? 'That code didn’t work — check it and try again.');
      return;
    }
    // Same reasoning as handleVerifyCode -- trust finalize()'s own error
    // rather than a possibly-stale signIn.status read.
    const { error: finalizeError } = await signIn.finalize({ navigate: () => {} });
    if (finalizeError) {
      setGeneralError(finalizeError.message ?? 'That code didn’t work — check it and try again.');
    }
  };

  if (stage === 'verify' || stage === 'trust') {
    return (
      <>
        <View style={styles.envelopeBadge}>
          <Text style={styles.envelopeBadgeText}>✉</Text>
        </View>
        <Text style={styles.cardTitle}>{stage === 'trust' ? 'Verify it’s you' : 'Check your email'}</Text>
        <Text style={styles.cardSubtitle}>Enter the code we just sent to{'\n'}{emailAddress}</Text>

        <CodeInput value={code} onChangeText={setCode} autoFocus />
        {errors.fields.code ? <Text style={styles.errorText}>{errors.fields.code.message}</Text> : null}
        {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

        <PressableScale
          onPress={stage === 'trust' ? handleVerifyTrust : handleVerifyCode}
          style={[styles.primaryButtonInCard, (code.length < 6 || isFetching) && styles.primaryButtonDisabled]}
        >
          {isFetching ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify  →</Text>}
        </PressableScale>
        <PressableScale
          onPress={() => {
            signIn.reset();
            setStage('identify');
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
      <Text style={styles.pageTitle}>Log in</Text>
      <Text style={styles.pageSubtitle}>Enter your email to get back into your cookbook.</Text>

      <TextInput
        value={emailAddress}
        onChangeText={setEmailAddress}
        onFocus={() => setEmailFocused(true)}
        onBlur={() => setEmailFocused(false)}
        placeholder="Email address"
        placeholderTextColor={colors.subtext}
        autoCapitalize="none"
        keyboardType="email-address"
        style={[styles.input, emailFocused && styles.inputFocused]}
      />
      {errors.fields.identifier ? <Text style={styles.errorText}>{errors.fields.identifier.message}</Text> : null}
      {generalError ? <Text style={styles.errorText}>{generalError}</Text> : null}

      <PressableScale
        onPress={handleSendCode}
        style={[styles.primaryButtonInCard, (!emailAddress || isFetching) && styles.primaryButtonDisabled]}
      >
        {isFetching ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send code  →</Text>}
      </PressableScale>
    </>
  );
}

const BLOB_SIZE = 320;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  blobTopRight: {
    position: 'absolute',
    top: -BLOB_SIZE * 0.55,
    right: -BLOB_SIZE * 0.45,
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    backgroundColor: colors.accent,
    opacity: 0.1,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -BLOB_SIZE * 0.6,
    left: -BLOB_SIZE * 0.5,
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    backgroundColor: colors.accent2,
    opacity: 0.1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
  },
  // --- Welcome stage ---
  welcomeWrap: {
    flex: 1,
    minHeight: 520,
    justifyContent: 'space-between',
  },
  welcomeHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Matches the source wordmark.png's ~2.22:1 aspect ratio.
  wordmarkImage: {
    width: 260,
    height: 117,
  },
  welcomeTagline: {
    color: colors.subtext,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  welcomeActions: {
    gap: 4,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loginLinkText: {
    color: colors.subtext,
    fontSize: 13.5,
  },
  loginLinkTextBold: {
    color: colors.foreground,
    fontFamily: fontFamily.bold,
    textDecorationLine: 'underline',
  },
  // --- Back button + card (signup/signin stages) ---
  backButtonWrap: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  backButtonText: {
    color: colors.foreground,
    fontSize: 17,
    fontFamily: fontFamily.bold,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: spacing.radiusSheet,
    padding: 22,
    ...elevation.raised,
  },
  pageTitle: {
    fontFamily: fontFamily.extraBold,
    color: colors.foreground,
    fontSize: 25,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    color: colors.subtext,
    fontSize: 13.5,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 22,
  },
  envelopeBadge: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  envelopeBadgeText: {
    fontSize: 20,
    color: colors.accent,
  },
  cardTitle: {
    fontFamily: fontFamily.extraBold,
    color: colors.foreground,
    fontSize: 19,
    textAlign: 'center',
  },
  cardSubtitle: {
    color: colors.subtext,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 22,
  },
  input: {
    backgroundColor: colors.canvas,
    borderRadius: spacing.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14.5,
    color: colors.foreground,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: '#fff',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12.5,
    marginTop: 8,
  },
  // Full-width pill on the plain canvas (welcome stage).
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 16,
    ...elevation.card,
  },
  // Same button, but with the top margin needed when it follows a field
  // inside the white card instead.
  primaryButtonInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 15,
    marginTop: 20,
    ...elevation.card,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
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
  footerText: {
    color: colors.subtext,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 22,
  },
});
