import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { PressableScale } from '../components/PressableScale';
import { BottomSheet } from '../components/BottomSheet';
import { ProfileSettingsRow } from '../components/ProfileSettingsRow';
import { getCookbookStatsViaBackend, getPreferencesViaBackend } from '../api/backend';
import { useAuthCapability } from '../navigation/AuthCapabilityContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';
import type { RootStackParamList } from '../types/navigation';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { name, email, photoUrl, signOut, updateName, updatePhoto } = useAuthCapability();
  const [recipeCount, setRecipeCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [plan, setPlan] = useState('free');
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    void getCookbookStatsViaBackend().then(({ total, favorites }) => {
      setRecipeCount(total);
      setFavoriteCount(favorites);
    });
    void getPreferencesViaBackend().then(({ plan: currentPlan }) => {
      setPlan(currentPlan);
    });
  }, []);

  const initial = name.trim().charAt(0).toUpperCase() || '?';

  const openEditProfile = () => {
    setNameDraft(name);
    setEditProfileOpen(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }
    setIsSavingName(true);
    try {
      await updateName(trimmed);
      setEditProfileOpen(false);
    } catch (err) {
      console.error('Failed to update name:', err);
      Alert.alert('Something went wrong', "That name couldn't be saved. Please try again.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Enable photo library access in Settings to add a picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) return;

    const dataUrl = `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;

    setIsUploadingPhoto(true);
    try {
      await updatePhoto(dataUrl);
    } catch (err) {
      console.error('Failed to update profile photo:', err);
      Alert.alert('Something went wrong', "That photo couldn't be saved. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your account</Text>

        <View style={styles.identityRow}>
          <View style={styles.avatarWrap}>
            <PressableScale onPress={handleChangePhoto} style={styles.avatar} disabled={isUploadingPhoto}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
              {isUploadingPhoto ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              ) : null}
            </PressableScale>
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>✎</Text>
            </View>
          </View>
          <View style={styles.identityTextWrap}>
            <PressableScale onPress={openEditProfile} style={styles.nameRow}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.editLink}>Edit</Text>
            </PressableScale>
            <Text style={styles.email}>{email}</Text>
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

      <BottomSheet visible={editProfileOpen} onDismiss={() => setEditProfileOpen(false)}>
        <Text style={styles.editProfileTitle}>Edit profile</Text>
        <PressableScale onPress={handleChangePhoto} style={styles.editProfileAvatarWrap} disabled={isUploadingPhoto}>
          <View style={styles.avatar}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
            {isUploadingPhoto ? (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : null}
          </View>
          <Text style={styles.editProfilePhotoLink}>Change photo</Text>
        </PressableScale>

        <Text style={styles.editProfileLabel}>Name</Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Name"
          placeholderTextColor={colors.subtext}
          autoCapitalize="words"
          style={styles.editProfileInput}
        />

        <View style={styles.editProfileButtonWrap}>
          <PressableScale
            onPress={handleSaveName}
            style={[styles.editProfileSave, (isSavingName || !nameDraft.trim()) && styles.editProfileSaveDisabled]}
          >
            {isSavingName ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.editProfileSaveText}>Save</Text>
            )}
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
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Small pencil badge pinned to the avatar's corner, purely a visual
  // affordance that the avatar is tappable -- the actual tap target is the
  // whole avatar (PressableScale), not this badge itself.
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadgeText: {
    color: '#fff',
    fontSize: 10,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
  },
  identityTextWrap: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  name: {
    color: colors.foreground,
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  editLink: {
    color: colors.accent,
    fontSize: 12.5,
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
  editProfileTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
    textAlign: 'center',
    marginBottom: 18,
  },
  editProfileAvatarWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  editProfilePhotoLink: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontSize: 13,
    marginTop: 8,
  },
  editProfileLabel: {
    color: colors.subtext,
    fontSize: 11,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  editProfileInput: {
    backgroundColor: colors.canvas,
    borderRadius: spacing.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14.5,
    color: colors.foreground,
  },
  editProfileButtonWrap: {
    marginTop: 22,
  },
  editProfileSave: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 15,
  },
  editProfileSaveDisabled: {
    opacity: 0.5,
  },
  editProfileSaveText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 15,
  },
});
