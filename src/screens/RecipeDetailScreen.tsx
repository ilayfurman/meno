import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  getRecipeVersionViaBackend,
  getRecipeViaBackend,
  setCurrentVersionViaBackend,
  setFavoriteViaBackend,
  setRecipePhotoViaBackend,
  setRecipeLinksViaBackend,
} from '../api/backend';
import { getCachedRecipe, removeCachedRecipe, setCachedRecipe } from '../state/recipeCache';
import { buildRecipeHtml } from '../utils/recipeExport';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';
import type { RecipeVersion, RecipeVersionSummary, StoredRecipe } from '../types';
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
  const [linksEditOpen, setLinksEditOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  // null means "adding a new link"; otherwise the index into recipe.links
  // being edited.
  const [linkEditIndex, setLinkEditIndex] = useState<number | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [deleteRecipeSheetOpen, setDeleteRecipeSheetOpen] = useState(false);
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false);
  const [versionPendingDelete, setVersionPendingDelete] = useState<RecipeVersionSummary | null>(null);
  const [isDeletingVersion, setIsDeletingVersion] = useState(false);
  // recipe.versions only carries summaries (id/version_number/change_note) --
  // this caches full ingredients/steps per version id, fetched on demand the
  // first time a version pill other than the current one is tapped, so
  // switching back to a version you've already viewed this session is
  // instant instead of re-fetching.
  const [versionContent, setVersionContent] = useState<Record<string, RecipeVersion>>({});

  // Shared by both the cache-hit and network-fetch paths below so version
  // bookkeeping (which pill is active, seeding the content cache with the
  // current version) stays in sync no matter where the data came from.
  const applyRecipe = useCallback((loaded: StoredRecipe) => {
    setRecipe(loaded);
    const idx = loaded.versions.findIndex((v) => v.id === loaded.current_version.id);
    setActiveVersionIndex(idx >= 0 ? idx : loaded.versions.length - 1);
    if (loaded.current_version.id) {
      setVersionContent((prev) => ({ ...prev, [loaded.current_version.id!]: loaded.current_version }));
    }
  }, []);

  // Write-through: every mutation below (favorite, photo, links, versions)
  // updates both local screen state and the shared cache in one call, so a
  // trip back to the Cookbook and back into this recipe never shows stale
  // data from before the edit. Deliberately does NOT reuse applyRecipe --
  // that always jumps to the recipe's default version, which is correct for
  // a fresh screen load but wrong here: a metadata-only edit (favorite,
  // photo, links) made while browsing an older version used to snap the
  // screen back to the default version even though the edit itself had
  // nothing to do with which version was selected. This keeps whatever
  // version was being viewed selected, as long as it still exists in the
  // updated recipe -- only falling back to the default version if it
  // doesn't (e.g. it was just deleted).
  const updateRecipe = useCallback((updated: StoredRecipe) => {
    setCachedRecipe(updated);
    setRecipe(updated);
    if (updated.current_version.id) {
      setVersionContent((prev) => ({ ...prev, [updated.current_version.id!]: updated.current_version }));
    }
    const activeId = recipe?.versions[activeVersionIndex]?.id;
    const stillThereIdx = activeId ? updated.versions.findIndex((v) => v.id === activeId) : -1;
    if (stillThereIdx >= 0) {
      setActiveVersionIndex(stillThereIdx);
    } else {
      const defaultIdx = updated.versions.findIndex((v) => v.id === updated.current_version.id);
      setActiveVersionIndex(defaultIdx >= 0 ? defaultIdx : updated.versions.length - 1);
    }
  }, [recipe, activeVersionIndex]);

  const load = useCallback(async () => {
    // Render instantly from the cache if the Cookbook screen's background
    // prefetch (or an earlier visit this session) already has this recipe,
    // rather than showing a spinner while a fetch that's often unnecessary
    // completes. Still follows up with a real fetch below either way, so a
    // stale cached copy (edited elsewhere, or just old) gets corrected --
    // this is "show what we have now, then quietly confirm it's current,"
    // not a replacement for the network fetch.
    const cached = getCachedRecipe(recipeId);
    if (cached) {
      applyRecipe(cached);
    }
    const loaded = await getRecipeViaBackend(recipeId);
    setCachedRecipe(loaded);
    applyRecipe(loaded);
  }, [recipeId, applyRecipe]);

  // Reload every time this screen comes into focus, not just on first mount
  // -- otherwise coming back from Edit recipe (which saves a new version)
  // would leave the screen showing stale, pre-edit content.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!recipe) {
    // A blank screen here reads as "the app is stuck" during the network
    // round trip -- a spinner at least confirms something's happening.
    return (
      <View style={[styles.screen, styles.loadingScreen]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Summary (id/version_number/change_note) is always available immediately
  // from recipe.versions. The full ingredients/steps for whichever version
  // that is may still be loading -- see activeVersionContent below.
  const activeVersionSummary = recipe.versions[activeVersionIndex] ?? recipe.current_version;
  const activeVersionContent = activeVersionSummary.id ? versionContent[activeVersionSummary.id] : recipe.current_version;
  const isViewingDefault = activeVersionSummary.id === recipe.current_version.id;

  // Tapping a version pill only changes what's previewed on screen -- it no
  // longer writes to the backend immediately. Making a version the recipe's
  // default (what shows up everywhere else, e.g. the Cookbook grid) is now
  // its own explicit action via the "Set as default" banner below, so
  // browsing your version history can't accidentally change what's default.
  const handleSelectVersion = (index: number) => {
    setActiveVersionIndex(index);
    const summary = recipe.versions[index];
    if (!summary?.id || versionContent[summary.id]) return;
    getRecipeVersionViaBackend(recipe.id, summary.id)
      .then((full) => setVersionContent((prev) => ({ ...prev, [summary.id!]: full })))
      .catch((err) => {
        console.error('Failed to load version:', err);
        Alert.alert('Something went wrong', "That version couldn't be loaded. Please try again.");
      });
  };

  const handleSetDefaultVersion = async () => {
    if (!activeVersionSummary.id) return;
    const updated = await setCurrentVersionViaBackend(recipe.id, activeVersionSummary.id);
    updateRecipe(updated);
  };

  const handleDeleteVersion = (version: RecipeVersionSummary) => {
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
        removeCachedRecipe(recipe.id);
        navigation.goBack();
        return;
      }
      updateRecipe(result.recipe);
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
      removeCachedRecipe(recipe.id);
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
    updateRecipe({ ...recipe, is_favorite: next });
    try {
      await setFavoriteViaBackend(recipe.id, next);
    } catch {
      updateRecipe({ ...recipe, is_favorite: !next });
    }
  };

  const handleOpenAddLink = () => {
    setLinkEditIndex(null);
    setLinkInput('');
    setLinksEditOpen(true);
  };

  const handleOpenEditLink = (index: number) => {
    setLinkEditIndex(index);
    setLinkInput(recipe.links[index]?.url ?? '');
    setLinksEditOpen(true);
  };

  // Full-replacement update -- always sends the whole desired links array,
  // not a single add/edit/remove delta (matches the backend endpoint).
  const handleSaveLink = async () => {
    const url = linkInput.trim();
    if (!url) return;
    const nextLinks = recipe.links.map((link) => ({ url: link.url }));
    if (linkEditIndex !== null) {
      nextLinks[linkEditIndex] = { url };
    } else {
      nextLinks.push({ url });
    }
    const updated = await setRecipeLinksViaBackend(recipe.id, nextLinks);
    updateRecipe(updated);
    setLinksEditOpen(false);
  };

  const handleRemoveLink = async () => {
    if (linkEditIndex === null) return;
    const nextLinks = recipe.links.filter((_, index) => index !== linkEditIndex).map((link) => ({ url: link.url }));
    const updated = await setRecipeLinksViaBackend(recipe.id, nextLinks);
    updateRecipe(updated);
    setLinksEditOpen(false);
  };

  const handleEditPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Enable photo library access in Settings to add a picture.');
      return;
    }

    // Matches the aspect ratio the photo is actually displayed at (below,
    // and on the Cookbook grid card) -- previously this cropped to 7:5 while
    // the grid card shows it at 1:1, so resizeMode="cover" silently cropped
    // it *again*, further than what the user chose in the picker. Keeping
    // one aspect ratio everywhere means what you crop is what you get.
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

    setPhotoUploading(true);
    try {
      const updated = await setRecipePhotoViaBackend(recipe.id, dataUrl);
      updateRecipe(updated);
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
          aspectRatio={1}
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

        {recipe.links.map((link, index) => (
          <VideoAttachmentCard
            key={`${link.url}-${index}`}
            videoUrl={link.url}
            videoPlatform={link.platform}
            onEdit={() => handleOpenEditLink(index)}
          />
        ))}

        <PressableScale onPress={handleOpenAddLink} style={styles.addVideoRow}>
          <View style={styles.addVideoIconBadge}>
            <Text style={styles.addVideoIconText}>▶</Text>
          </View>
          <View style={styles.addVideoTextWrap}>
            <Text style={styles.addVideoTitle}>{recipe.links.length > 0 ? 'Add another link' : 'Add a link'}</Text>
            <Text style={styles.addVideoSubtitle}>Attach the TikTok, Reel, YouTube video, or website you got this from</Text>
          </View>
          <Text style={styles.addVideoChevron}>›</Text>
        </PressableScale>

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
                  Set v{activeVersionSummary.version_number} as the default version
                </Text>
              </PressableScale>
            ) : null}
          </View>
        ) : null}

        {activeVersionSummary.change_note ? (
          <View style={styles.changeNoteBox}>
            <Text style={styles.changeNoteText}>{activeVersionSummary.change_note}</Text>
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

        {activeVersionContent ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionKicker}>Ingredients</Text>
              <Text style={styles.sectionCount}>{activeVersionContent.ingredients.length}</Text>
            </View>
            <View style={styles.sectionCard}>
              <IngredientsList ingredients={activeVersionContent.ingredients} />
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionKicker}>Steps</Text>
              <Text style={styles.sectionCount}>{activeVersionContent.steps.length}</Text>
            </View>
            <View style={styles.sectionCard}>
              <StepsList steps={activeVersionContent.steps} />
            </View>
          </>
        ) : (
          // Only reachable while a version other than the current one (which
          // always arrives with the initial load) is still being fetched.
          <View style={styles.versionLoadingWrap}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        <PressableScale onPress={() => setDeleteRecipeSheetOpen(true)} style={styles.deleteRecipeRow}>
          <Text style={styles.deleteRecipeText}>Delete recipe</Text>
        </PressableScale>
      </ScrollView>

      <ContinueIteratingSheet visible={continueSheetOpen} onDismiss={() => setContinueSheetOpen(false)} recipe={recipe} />

      <BottomSheet visible={linksEditOpen} onDismiss={() => setLinksEditOpen(false)}>
        <View style={styles.videoEditIconBadge}>
          <Text style={styles.videoEditIconText}>▶</Text>
        </View>
        <Text style={styles.videoEditTitle}>{linkEditIndex !== null ? 'Edit link' : 'Add a link'}</Text>
        <Text style={styles.videoEditSubtitle}>
          Paste a TikTok, Instagram, or YouTube link, or a website — it'll show up right on the recipe.
        </Text>
        <TextInput
          value={linkInput}
          onChangeText={setLinkInput}
          placeholder="https://..."
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.videoInput}
        />
        <View style={styles.videoEditActions}>
          <View style={styles.videoEditButtonWrap}>
            <PressableScale onPress={() => setLinksEditOpen(false)} style={styles.videoEditCancel}>
              <Text style={styles.videoEditCancelText}>Cancel</Text>
            </PressableScale>
          </View>
          <View style={styles.videoEditButtonWrap}>
            <PressableScale onPress={handleSaveLink} style={styles.primaryActionButton}>
              <Text style={styles.primaryActionButtonText}>Save</Text>
            </PressableScale>
          </View>
        </View>
        {linkEditIndex !== null ? (
          <PressableScale onPress={handleRemoveLink} style={styles.videoEditRemove}>
            <Text style={styles.videoEditRemoveText}>Remove link</Text>
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
  loadingScreen: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionLoadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
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
