import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { PressableScale } from '../components/PressableScale';
import { BottomSheet } from '../components/BottomSheet';
import { ProfileSettingsRow } from '../components/ProfileSettingsRow';
import { getCookbookViaBackend, getPreferencesViaBackend } from '../api/backend';
import { useAppContext } from '../navigation/AppContext';
import { useAuthCapability } from '../navigation/AuthCapabilityContext';
import { getFaceIdLockEnabled, setFaceIdLockEnabled } from '../storage/security';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';
import type { RootStackParamList } from '../types/navigation';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userProfile } = useAppContext();
  const { signOut, clerkEnabled } = useAuthCapability();
  const [recipeCount, setRecipeCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [plan, setPlan] = useState('free');
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [faceIdLock, setFaceIdLock] = useState(false);

  useEffect(() => {
    void getCookbookViaBackend().then((recipes) => {
      setRecipeCount(recipes.length);
      setFavoriteCount(recipes.filter((r) => r.is_favorite).length);
    });
    void getPreferencesViaBackend().then(({ plan: currentPlan }) => {
      setPlan(currentPlan);
    });
    void getFaceIdLockEnabled().then(setFaceIdLock);
  }, []);

  const handleToggleFaceIdLock = async (next: boolean) => {
    if (next) {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Face ID not set up',
          'Set up Face ID or Touch ID in your device settings first, then turn this on.',
        );
        return;
      }
    }
    setFaceIdLock(next);
    void setFaceIdLockEnabled(next);
  };

  const initial = userProfile.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your account</Text>

        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View>
            <Text style={styles.name}>{userProfile.name}</Text>
            <Text style={styles.email}>{userProfile.email}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{recipeCount}</Text>
            <Text style={styles.statLabel}>Recipes</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Connected</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{favoriteCount}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
        </View>

        <PressableScale onPress={() => navigation.navigate('ProfilePlans')} style={styles.planCard}>
          <View>
            <Text style={styles.planName}>{plan === 'free' ? 'Free plan' : 'Meno Plus'}</Text>
            <Text style={styles.planSummary}>
              {plan === 'free' ? 'Quick Generate + manual save/import' : 'Higher quota + priority import'}
            </Text>
          </View>
          <View style={styles.upgradePill}>
            <Text style={styles.upgradePillText}>Upgrade</Text>
          </View>
        </PressableScale>

        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.groupedList}>
          <ProfileSettingsRow label="Notifications" onPress={() => navigation.navigate('ProfileNotifications')} isLast />
        </View>

        {clerkEnabled ? (
          <>
            <Text style={styles.sectionLabel}>Security</Text>
            <View style={styles.groupedList}>
              <View style={[styles.toggleRow, styles.toggleRowLast]}>
                <View style={styles.toggleRowText}>
                  <Text style={styles.toggleLabel}>Face ID Lock</Text>
                  <Text style={styles.toggleDescription}>Require Face ID to reopen Meno on this device.</Text>
                </View>
                <Switch
                  value={faceIdLock}
                  onValueChange={handleToggleFaceIdLock}
                  trackColor={{ true: colors.accent2, false: colors.hairline }}
                />
              </View>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.groupedList}>
          <ProfileSettingsRow label="Help Center" onPress={() => navigation.navigate('ProfileHelpCenter')} />
          <ProfileSettingsRow label="Contact us" onPress={() => navigation.navigate('ProfileContactUs')} />
          <ProfileSettingsRow label="Rate Meno" onPress={() => navigation.navigate('ProfileRateMeno')} isLast />
        </View>

        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.groupedList}>
          <ProfileSettingsRow label="Terms of Service" onPress={() => navigation.navigate('ProfileTerms')} />
          <ProfileSettingsRow label="Privacy Policy" onPress={() => navigation.navigate('ProfilePrivacy')} isLast />
        </View>

        <PressableScale onPress={() => setSignOutOpen(true)} style={styles.signOutRow}>
          <Text style={styles.signOutText}>Sign out</Text>
        </PressableScale>
      </ScrollView>

      <BottomSheet visible={signOutOpen} onDismiss={() => setSignOutOpen(false)}>
        <View style={styles.signOutIconBadge}>
          <Text style={styles.signOutIconText}>👋</Text>
        </View>
        <Text style={styles.signOutTitle}>Sign out of Meno?</Text>
        <Text style={styles.signOutSubtitle}>You can sign back in anytime — your cookbook stays saved.</Text>
        <View style={styles.signOutActions}>
          {/* PressableScale forwards `style` to its inner Animated.View, not
              the outer Pressable that participates in row layout -- flex:1
              has to live on a plain wrapping View, or these two buttons
              never actually split the row evenly. Same bug fixed elsewhere
              this session. */}
          <View style={styles.signOutButtonWrap}>
            <PressableScale onPress={() => setSignOutOpen(false)} style={styles.signOutCancel}>
              <Text style={styles.signOutCancelText}>Cancel</Text>
            </PressableScale>
          </View>
          <View style={styles.signOutButtonWrap}>
            <PressableScale
              onPress={async () => {
                // signOut is null under dev-auth (no Clerk configured yet) —
                // there's no real session to end in that case.
                if (signOut) {
                  await signOut();
                }
                setSignOutOpen(false);
              }}
              style={styles.signOutConfirm}
            >
              <Text style={styles.signOutConfirmText}>Sign out</Text>
            </PressableScale>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 120,
    gap: 4,
  },
  title: {
    fontFamily: typography.screenTitle.fontFamily,
    color: colors.foreground,
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: 14,
    marginBottom: 16,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
  },
  name: {
    color: colors.foreground,
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  email: {
    color: colors.subtext,
    fontSize: 13,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: spacing.radiusCard,
    paddingVertical: 14,
    alignItems: 'center',
    ...elevation.card,
  },
  statValue: {
    color: colors.foreground,
    fontSize: 20,
    fontFamily: fontFamily.extraBold,
  },
  statLabel: {
    color: colors.subtext,
    fontSize: 11.5,
    marginTop: 2,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.foreground,
    borderRadius: spacing.radiusCard,
    padding: 16,
    marginBottom: 20,
    ...elevation.raised,
  },
  planName: {
    color: '#fff',
    fontSize: 15,
    fontFamily: fontFamily.extraBold,
  },
  planSummary: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  upgradePill: {
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  upgradePillText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 12,
  },
  sectionLabel: {
    color: colors.subtext,
    fontSize: 11,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
  },
  groupedList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    ...elevation.card,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineAlt,
    gap: 12,
  },
  toggleRowLast: {
    borderBottomWidth: 0,
  },
  toggleRowText: {
    flex: 1,
  },
  toggleLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontFamily: fontFamily.bold,
  },
  toggleDescription: {
    color: colors.subtext,
    fontSize: 12,
    marginTop: 2,
  },
  signOutRow: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  signOutText: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontSize: 14,
  },
  signOutIconBadge: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  signOutIconText: {
    fontSize: 24,
  },
  signOutTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
    textAlign: 'center',
  },
  signOutSubtitle: {
    color: colors.subtext,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 22,
    lineHeight: 19,
  },
  signOutActions: {
    flexDirection: 'row',
    gap: 10,
  },
  // flex:1 lives on this wrapper, not on the PressableScale itself -- see
  // the comment above the JSX for why.
  signOutButtonWrap: {
    flex: 1,
  },
  signOutCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: spacing.radiusPill,
    backgroundColor: colors.canvas,
  },
  signOutCancelText: {
    color: colors.foreground,
    fontFamily: fontFamily.bold,
  },
  signOutConfirm: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 14,
  },
  signOutConfirmText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
  },
});
