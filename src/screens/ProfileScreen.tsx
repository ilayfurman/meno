import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PressableScale } from '../components/PressableScale';
import { BottomSheet } from '../components/BottomSheet';
import { ProfileSettingsRow } from '../components/ProfileSettingsRow';
import { getCookbookViaBackend, getPreferencesViaBackend } from '../api/backend';
import { useAppContext } from '../navigation/AppContext';
import { useAuthCapability } from '../navigation/AuthCapabilityContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';
import type { RootStackParamList } from '../types/navigation';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userProfile } = useAppContext();
  const { signOut } = useAuthCapability();
  const [recipeCount, setRecipeCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [dietSummary, setDietSummary] = useState('Not set');
  const [plan, setPlan] = useState('free');
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    void getCookbookViaBackend().then((recipes) => {
      setRecipeCount(recipes.length);
      setFavoriteCount(recipes.filter((r) => r.is_favorite).length);
    });
    void getPreferencesViaBackend().then(({ preferences, plan: currentPlan }) => {
      const summary = [preferences.diet, ...preferences.avoid].filter(Boolean).join(', ');
      setDietSummary(summary || 'Not set');
      setPlan(currentPlan);
    });
  }, []);

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
          <ProfileSettingsRow label="Dietary & allergies" value={dietSummary} onPress={() => navigation.navigate('ProfileDietary')} />
          <ProfileSettingsRow label="Notifications" onPress={() => navigation.navigate('ProfileNotifications')} isLast />
        </View>

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
        <Text style={styles.signOutTitle}>Sign out of Meno?</Text>
        <View style={styles.signOutActions}>
          <PressableScale onPress={() => setSignOutOpen(false)} style={styles.signOutCancel}>
            <Text style={styles.signOutCancelText}>Cancel</Text>
          </PressableScale>
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
  signOutTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontFamily: fontFamily.bold,
    marginBottom: 16,
    textAlign: 'center',
  },
  signOutActions: {
    flexDirection: 'row',
    gap: 10,
  },
  signOutCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  signOutCancelText: {
    color: colors.subtext,
    fontFamily: fontFamily.bold,
  },
  signOutConfirm: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 14,
  },
  signOutConfirmText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
  },
});
