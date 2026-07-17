import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MattedPhoto } from '../components/MattedPhoto';
import { TagPill } from '../components/TagPill';
import { PressableScale } from '../components/PressableScale';
import { BottomSheet } from '../components/BottomSheet';
import { VideoAttachmentCard } from '../components/VideoAttachmentCard';
import { ContinueIteratingSheet } from '../components/ContinueIteratingSheet';
import { IngredientsList } from '../components/IngredientsList';
import { StepsList } from '../components/StepsList';
import {
  deleteRecipeVersionViaBackend,
  deleteRecipeViaBackend,
  getRecipeViaBackend,
  setCurrentVersionViaBackend,
  setFavoriteViaBackend,
  setRecipePhotoViaBackend,
  setVideoLinkViaBackend,
} from '../api/backend';
import { buildRecipeHtml } from '../utils/recipeExport';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';
import type { RecipeVersion, StoredRecipe } from '../types';
import type { RootStackParamList } from '../types/navigation';

type Route = RouteProp<RootStackParamList, 'RecipeDetail'>;

export function RecipeDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { recipeId } = route.params;

  const [recipe, setRecipe] = useState<StoredRecipe | null>(null);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [continueSheetOpen, setContinueSheetOpen] = useState(false);
  const [videoEditOpen, setVideoEditOpen] = useState(false);
  const [videoInput, setVideoInput] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [deleteRecipeSheetOpen, setDeleteRecipeSheetOpen] = useState(false);
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false);
  const [versionPendingDelete, setVersionPendingDelete] = useState<RecipeVersion | null>(null);
  const [isDeletingVersion, setIsDeletingVersion] = useState(false);

  const load = useCallback(async () => {
    const loaded = await getRecipeViaBackend(recipeId);
    setRecipe(loaded);
    const idx = loaded.versions.findIndex((v) => v.id === loaded.current_version.id);
    setActiveVersionIndex(idx >= 0 ? idx : loaded.versions.length - 1);
  }, [recipeId]);

  // Reload every time this screen comes into focus, not just on first mount
  // -- otherwise coming back from Edit recipe (which saves a new version)
  // would leave the screen showing stale, pre-edit content.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!recipe) {
    return <View style={styles.screen} />;
  }

  const activeVersion = recipe.versions[activeVersionIndex] ?? recipe.current_version;
  const isViewingDefault = activeVersion.id === recipe.current_version.id;

  // Tapping a version pill only changes what's previewed on screen -- it no
  // longer writes to the backend immediately. Making a version the recipe's
  // default (what shows up everywhere else, e.g. the Cookbook grid) is now
  // its own explicit action via the "Set as default" banner below, so
  // browsing your version history can't accidentally change what's default.
  const handleSelectVersion = (index: number) => {
    setActiveVersionIndex(index);
  };

  const handleSetDefaultVersion = async () => {
    if (!activeVersion.id) return;
    const updated = await setCurrentVersionViaBackend(recipe.id, activeVersion.id);
    setRecipe(updated);
  };

  const handleDeleteVersion = (version: RecipeVersion) => {
    if (!version.id) return;
    if (recipe.versions.length <= 1) {
      Alert.alert(
        "Can't delete the only version",
        'A recipe needs at least one version — delete the whole recipe instead if you want it gone.',
      );
      return;
    }
    // Opens the same in-app confirmation sheet used for deleting the whole
    // recipe (and for signing out) rather than a native Alert -- one
    // destructive-confirmation style throughout the app instead of two.
    setVersionPendingDelete(version);
  };

  const handleConfirmDeleteVersion = async () => {
    if (!versionPendingDelete?.id) return;
    setIsDeletingVersion(true);
    try {
      const result = await deleteRecipeVersionViaBackend(recipe.id, versionPendingDelete.id);
      setVersionPendingDelete(null);
      if (result.deletedRecipe || !result.recipe) {
        navigation.goBack();
        return;
      }
      const updated = result.recipe;
      setRecipe(updated);
      const idx = updated.versions.findIndex((v) => v.id === updated.current_version.id);
      setActiveVersionIndex(idx >= 0 ? idx : 0);
    } catch (err) {
      console.error('Failed to delete version:', err);
      Alert.alert('Something went wrong', "That version couldn't be deleted. Please try again.");
    } finally {
      setIsDeletingVersion(false);
    }
  };

  const handleShare = async () => {
    setIsSharingPdf(true);
    try {
      const html = buildRecipeHtml(recipe);
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Sharing unavailable', "Your device doesn't support sharing right now.");
      }
    } catch (err) {
      console.error('Failed to share recipe:', err);
      Alert.alert('Something went wrong', "That recipe couldn't be shared. Please try again.");
    } finally {
      setIsSharingPdf(false);
    }
  };

  const handleDeleteRecipe = async () => {
    setIsDeletingRecipe(true);
    try {
      await deleteRecipeViaBackend(recipe.id);
      setDeleteRecipeSheetOpen(false);
      navigation.goBack();
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      setIsDeletingRecipe(false);
      Alert.alert('Something went wrong', "This recipe couldn't be deleted. Please try again.");
    }
  };

  const handleToggleFavorite = async () => {
    const next = !recipe.is_favorite;
    setRecipe({ ...recipe, is_favorite: next });
    try {
      await setFavoriteViaBackend(recipe.id, next);
    } catch {
      setRecipe({ ...recipe, is_favorite: !next });
    }
  };

  const handleOpenVideoEdit = () => {
    setVideoInput(recipe.video_url ?? '');
    setVideoEditOpen(true);
  };

  const handleSaveVideo = async () => {
    const updated = await setVideoLinkViaBackend(recipe.id, videoInput.trim() || null);
    setRecipe(updated);
    setVideoEditOpen(false);
  };

  const handleRemoveVideo = async () => {
    const updated = await setVideoLinkViaBackend(recipe.id, null);
    setRecipe(updated);
    setVideoEditOpen(false);
  };

  const handleEditPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Enable photo library access in Settings to add a picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [7, 5],
      quality: 0.5,
      base64: true,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) return;

    const dataUrl = `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;

    setPhotoUploading(true);
    try {
      const updated = await setRecipePhotoViaBackend(recipe.id, dataUrl);
      setRecipe(updated);
    } catch (err) {
      console.error('Failed to update recipe photo:', err);
      Alert.alert('Something went wrong', "That photo couldn't be saved. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButton} scaleTo={0.9}>
          <Text style={styles.backButtonText}>✕</Text>
        </PressableScale>

        <MattedPhoto
          uri={recipe.image_url}
          aspectRatio={1.4}
          borderRadius={22}
          onEditPress={handleEditPhoto}
          editing={photoUploading}
        />

        <Text style={styles.title}>{recipe.title}</Text>

        <View style={styles.metaRow}>
          <TagPill label={`${recipe.total_time_minutes} min`} />
          <TagPill label={recipe.cuisine} />
          <TagPill label={`serves ${recipe.servings}`} />
        </View>

        {recipe.video_url && recipe.video_platform ? (
          <VideoAttachmentCard videoUrl={recipe.video_url} videoPlatform={recipe.video_platform} onEdit={handleOpenVideoEdit} />
        ) : (
          <PressableScale onPress={handleOpenVideoEdit} style={styles.addVideoRow}>
            <View style={styles.addVideoIconBadge}>
              <Text style={styles.addVideoIconText}>▶</Text>
            </View>
            <View style={styles.addVideoTextWrap}>
              <Text style={styles.addVideoTitle}>Add a video link</Text>
              <Text style={styles.addVideoSubtitle}>Attach the TikTok, Reel, or YouTube video you got this from</Text>
            </View>
            <Text style={styles.addVideoChevron}>›</Text>
          </PressableScale>
        )}

        {recipe.versions.length > 1 ? (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.versionStrip}>
              {recipe.versions.map((version, index) => {
                const isDefault = version.id === recipe.current_version.id;
                const isViewing = index === activeVersionIndex;
                return (
                  <PressableScale
                    key={version.id ?? index}
                    onPress={() => handleSelectVersion(index)}
                    onLongPress={() => handleDeleteVersion(version)}
                    style={[styles.versionPill, isViewing && styles.versionPillActive]}
                  >
                    <Text style={[styles.versionPillText, isViewing && styles.versionPillTextActive]}>
                      v{version.version_number}
                      {isDefault ? ' · Default' : ''}
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
            <Text style={styles.versionHint}>Long-press a version to delete it</Text>
            {!isViewingDefault ? (
              <PressableScale onPress={handleSetDefaultVersion} style={styles.setDefaultBanner}>
                <Text style={styles.setDefaultBannerText}>
                  Set v{activeVersion.version_number} as the default version
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ) : null}

        {activeVersion.change_note ? (
          <View style={styles.changeNoteBox}>
            <Text style={styles.changeNoteText}>{activeVersion.change_note}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <View style={styles.iconButtonWrap}>
            <PressableScale
              onPress={handleToggleFavorite}
              style={[styles.iconButton, recipe.is_favorite && styles.iconButtonActive]}
            >
              <Text style={[styles.iconButtonText, recipe.is_favorite && styles.iconButtonTextActive]}>
                {recipe.is_favorite ? '♥' : '♡'}
              </Text>
            </PressableScale>
          </View>
          <View style={styles.iconButtonWrap}>
            <PressableScale onPress={handleShare} style={styles.iconButton} disabled={isSharingPdf}>
              <Ionicons name="share-outline" size={20} color={colors.foreground} />
            </PressableScale>
          </View>
          <View style={styles.iconButtonWrap}>
            <PressableScale onPress={() => navigation.navigate('EditRecipe', { recipeId: recipe.id })} style={styles.iconButton}>
              <Text style={styles.iconButtonText}>✎</Text>
            </PressableScale>
          </View>
          <View style={styles.continueButtonWrap}>
            <PressableScale onPress={() => setContinueSheetOpen(true)} style={styles.primaryActionButton}>
              <Text style={styles.primaryActionButtonText}>✦ Continue iterating</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionKicker}>Ingredients</Text>
          <Text style={styles.sectionCount}>{activeVersion.ingredients.length}</Text>
        </View>
        <View style={styles.sectionCard}>
          <IngredientsList ingredients={activeVersion.ingredients} />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionKicker}>Steps</Text>
          <Text style={styles.sectionCount}>{activeVersion.steps.length}</Text>
        </View>
        <View style={styles.sectionCard}>
          <StepsList steps={activeVersion.steps} />
        </View>

        <PressableScale onPress={() => setDeleteRecipeSheetOpen(true)} style={styles.deleteRecipeRow}>
          <Text style={styles.deleteRecipeText}>Delete recipe</Text>
        </PressableScale>
      </ScrollView>

      <ContinueIteratingSheet visible={continueSheetOpen} onDismiss={() => setContinueSheetOpen(false)} recipe={recipe} />

      <BottomSheet visible={videoEditOpen} onDismiss={() => setVideoEditOpen(false)}>
        <View style={styles.videoEditIconBadge}>
          <Text style={styles.videoEditIconText}>▶</Text>
        </View>
        <Text style={styles.videoEditTitle}>{recipe.video_url ? 'Edit video link' : 'Add a video link'}</Text>
        <Text style={styles.videoEditSubtitle}>Paste a TikTok, Instagram, or YouTube link — it'll show up right on the recipe.</Text>
        <TextInput
          value={videoInput}
          onChangeText={setVideoInput}
          placeholder="https://..."
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.videoInput}
        />
        <View style={styles.videoEditActions}>
          <View style={styles.videoEditButtonWrap}>
            <PressableScale onPress={() => setVideoEditOpen(false)} style={styles.videoEditCancel}>
              <Text style={styles.videoEditCancelText}>Cancel</Text>
            </PressableScale>
          </View>
          <View style={styles.videoEditButtonWrap}>
            <PressableScale onPress={handleSaveVideo} style={styles.primaryActionButton}>
              <Text style={styles.primaryActionButtonText}>Save</Text>
            </PressableScale>
          </View>
        </View>
        {recipe.video_url ? (
          <PressableScale onPress={handleRemoveVideo} style={styles.videoEditRemove}>
            <Text style={styles.videoEditRemoveText}>Remove video link</Text>
          </PressableScale>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={deleteRecipeSheetOpen} onDismiss={() => setDeleteRecipeSheetOpen(false)}>
        <View style={styles.deleteRecipeIconBadge}>
          <Text style={styles.deleteRecipeIconText}>🗑</Text>
        </View>
        <Text style={styles.deleteRecipeTitle}>Delete {recipe.title}?</Text>
        <Text style={styles.deleteRecipeSubtitle}>
          This removes every version and can&apos;t be undone.
        </Text>
        <View style={styles.deleteRecipeActions}>
          {/* flex:1 lives on the wrapping View, not PressableScale itself --
              see the note above the sign-out dialog in ProfileScreen for why. */}
          <View style={styles.deleteRecipeButtonWrap}>
            <PressableScale onPress={() => setDeleteRecipeSheetOpen(false)} style={styles.deleteRecipeCancel} disabled={isDeletingRecipe}>
              <Text style={styles.deleteRecipeCancelText}>Cancel</Text>
            </PressableScale>
          </View>
          <View style={styles.deleteRecipeButtonWrap}>
            <PressableScale onPress={handleDeleteRecipe} style={styles.deleteRecipeConfirm} disabled={isDeletingRecipe}>
              <Text style={styles.deleteRecipeConfirmText}>{isDeletingRecipe ? 'Deleting…' : 'Delete'}</Text>
            </PressableScale>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={versionPendingDelete !== null} onDismiss={() => setVersionPendingDelete(null)}>
        <View style={styles.deleteRecipeIconBadge}>
          <Text style={styles.deleteRecipeIconText}>🗑</Text>
        </View>
        <Text style={styles.deleteRecipeTitle}>Delete v{versionPendingDelete?.version_number}?</Text>
        <Text style={styles.deleteRecipeSubtitle}>This version will be permanently removed.</Text>
        <View style={styles.deleteRecipeActions}>
          <View style={styles.deleteRecipeButtonWrap}>
            <PressableScale onPress={() => setVersionPendingDelete(null)} style={styles.deleteRecipeCancel} disabled={isDeletingVersion}>
              <Text style={styles.deleteRecipeCancelText}>Cancel</Text>
            </PressableScale>
          </View>
          <View style={styles.deleteRecipeButtonWrap}>
            <PressableScale onPress={handleConfirmDeleteVersion} style={styles.deleteRecipeConfirm} disabled={isDeletingVersion}>
              <Text style={styles.deleteRecipeConfirmText}>{isDeletingVersion ? 'Deleting…' : 'Delete'}</Text>
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
    padding: spacing.screenPadding,
    paddingBottom: 60,
    gap: 12,
  },
  backButton: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    ...elevation.card,
  },
  backButtonText: {
    color: colors.foreground,
    fontSize: 17,
    fontFamily: fontFamily.bold,
  },
  title: {
    fontFamily: typography.screenTitle.fontFamily,
    color: colors.foreground,
    fontSize: 24,
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  addVideoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: spacing.radiusCard,
    padding: 14,
    ...elevation.card,
  },
  addVideoIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.matBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addVideoIconText: {
    color: colors.accent,
    fontSize: 13,
  },
  addVideoTextWrap: {
    flex: 1,
  },
  addVideoTitle: {
    color: colors.foreground,
    fontFamily: fontFamily.bold,
    fontSize: 14,
  },
  addVideoSubtitle: {
    color: colors.subtext,
    fontSize: 12,
    marginTop: 2,
  },
  addVideoChevron: {
    color: colors.subtext,
    fontSize: 20,
    fontFamily: fontFamily.semiBold,
  },
  versionStrip: {
    flexGrow: 0,
  },
  versionPill: {
    borderRadius: spacing.radiusPill,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  versionPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  versionPillText: {
    ...typography.versionPill,
    color: colors.subtext,
  },
  versionPillTextActive: {
    color: '#fff',
  },
  versionHint: {
    color: colors.subtext,
    fontSize: 11,
    marginTop: 6,
  },
  setDefaultBanner: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 4,
  },
  setDefaultBannerText: {
    color: colors.accent,
    fontFamily: fontFamily.semiBold,
    fontSize: 12.5,
    textDecorationLine: 'underline',
  },
  changeNoteBox: {
    backgroundColor: colors.matBackground,
    borderRadius: 14,
    padding: 12,
  },
  changeNoteText: {
    color: colors.foreground,
    fontStyle: 'italic',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  iconButtonWrap: {},
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  iconButtonActive: {
    backgroundColor: '#f4e3da',
  },
  iconButtonText: {
    color: colors.foreground,
    fontSize: 19,
  },
  iconButtonTextActive: {
    color: colors.accent,
  },
  continueButtonWrap: {
    flex: 1,
  },
  primaryActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
  },
  primaryActionButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 8,
  },
  sectionKicker: {
    fontFamily: typography.sectionKicker.fontFamily,
    color: colors.subtext,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionCount: {
    color: colors.subtext,
    fontSize: 11,
    fontFamily: fontFamily.semiBold,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: spacing.radiusCard,
    padding: 16,
    ...elevation.card,
  },
  videoEditIconBadge: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.matBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  videoEditIconText: {
    color: colors.accent,
    fontSize: 18,
  },
  videoEditTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
    textAlign: 'center',
  },
  videoEditSubtitle: {
    color: colors.subtext,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  videoInput: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: spacing.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  videoEditActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  videoEditButtonWrap: {
    flex: 1,
  },
  videoEditCancel: {
    height: 46,
    borderRadius: spacing.radiusPill,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoEditCancelText: {
    color: colors.foreground,
    fontFamily: fontFamily.bold,
    fontSize: 14,
  },
  videoEditRemove: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 4,
  },
  videoEditRemoveText: {
    color: colors.danger,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
  deleteRecipeRow: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  deleteRecipeText: {
    color: colors.danger,
    fontFamily: fontFamily.semiBold,
    fontSize: 13.5,
  },
  deleteRecipeIconBadge: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  deleteRecipeIconText: {
    fontSize: 22,
  },
  deleteRecipeTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
    textAlign: 'center',
  },
  deleteRecipeSubtitle: {
    color: colors.subtext,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 22,
    lineHeight: 19,
  },
  deleteRecipeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteRecipeButtonWrap: {
    flex: 1,
  },
  deleteRecipeCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: spacing.radiusPill,
    backgroundColor: colors.canvas,
  },
  deleteRecipeCancelText: {
    color: colors.foreground,
    fontFamily: fontFamily.bold,
  },
  deleteRecipeConfirm: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: spacing.radiusPill,
    paddingVertical: 14,
  },
  deleteRecipeConfirmText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
  },
});
