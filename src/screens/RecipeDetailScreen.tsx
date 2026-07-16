import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MattedPhoto } from '../components/MattedPhoto';
import { TagPill } from '../components/TagPill';
import { PressableScale } from '../components/PressableScale';
import { BottomSheet } from '../components/BottomSheet';
import { VideoAttachmentCard } from '../components/VideoAttachmentCard';
import { ShareRecipeSheet } from '../components/ShareRecipeSheet';
import { ContinueIteratingSheet } from '../components/ContinueIteratingSheet';
import { IngredientsList } from '../components/IngredientsList';
import { StepsList } from '../components/StepsList';
import {
  getRecipeViaBackend,
  setCurrentVersionViaBackend,
  setFavoriteViaBackend,
  setVideoLinkViaBackend,
} from '../api/backend';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';
import type { StoredRecipe } from '../types';
import type { RootStackParamList } from '../types/navigation';

type Route = RouteProp<RootStackParamList, 'RecipeDetail'>;

export function RecipeDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { recipeId } = route.params;

  const [recipe, setRecipe] = useState<StoredRecipe | null>(null);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [continueSheetOpen, setContinueSheetOpen] = useState(false);
  const [videoEditOpen, setVideoEditOpen] = useState(false);
  const [videoInput, setVideoInput] = useState('');

  const load = useCallback(async () => {
    const loaded = await getRecipeViaBackend(recipeId);
    setRecipe(loaded);
    const idx = loaded.versions.findIndex((v) => v.id === loaded.current_version.id);
    setActiveVersionIndex(idx >= 0 ? idx : loaded.versions.length - 1);
  }, [recipeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!recipe) {
    return <View style={styles.screen} />;
  }

  const activeVersion = recipe.versions[activeVersionIndex] ?? recipe.current_version;

  const handleSelectVersion = async (index: number) => {
    setActiveVersionIndex(index);
    const version = recipe.versions[index];
    if (!version?.id) return;
    const updated = await setCurrentVersionViaBackend(recipe.id, version.id);
    setRecipe(updated);
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButton} scaleTo={0.9}>
          <Text style={styles.backButtonText}>✕</Text>
        </PressableScale>

        <MattedPhoto uri={null} aspectRatio={1.4} borderRadius={22} />

        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.meta}>
          {recipe.total_time_minutes} min · {recipe.cuisine} · serves {recipe.servings}
        </Text>

        <View style={styles.tagRow}>
          {recipe.versions.length > 1 ? <TagPill label={`v${activeVersion.version_number}`} variant="version" /> : null}
        </View>

        {recipe.video_url && recipe.video_platform ? (
          <VideoAttachmentCard videoUrl={recipe.video_url} videoPlatform={recipe.video_platform} onEdit={handleOpenVideoEdit} />
        ) : (
          <PressableScale onPress={handleOpenVideoEdit} style={styles.addVideoRow}>
            <Text style={styles.addVideoText}>+ Add a video link</Text>
          </PressableScale>
        )}

        {recipe.versions.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.versionStrip}>
            {recipe.versions.map((version, index) => (
              <PressableScale
                key={version.id ?? index}
                onPress={() => handleSelectVersion(index)}
                style={[styles.versionPill, index === activeVersionIndex && styles.versionPillActive]}
              >
                <Text style={[styles.versionPillText, index === activeVersionIndex && styles.versionPillTextActive]}>
                  v{version.version_number}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        ) : null}

        {activeVersion.change_note ? (
          <View style={styles.changeNoteBox}>
            <Text style={styles.changeNoteText}>{activeVersion.change_note}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <PressableScale onPress={handleToggleFavorite} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>{recipe.is_favorite ? '♥ Favorited' : '♡ Favorite'}</Text>
          </PressableScale>
          <PressableScale onPress={() => setShareSheetOpen(true)} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Share</Text>
          </PressableScale>
          <PressableScale onPress={() => setContinueSheetOpen(true)} style={styles.primaryActionButton}>
            <Text style={styles.primaryActionButtonText}>Continue iterating</Text>
          </PressableScale>
        </View>

        <Text style={styles.sectionKicker}>Ingredients</Text>
        <IngredientsList ingredients={activeVersion.ingredients} />

        <Text style={styles.sectionKicker}>Steps</Text>
        <StepsList steps={activeVersion.steps} />
      </ScrollView>

      <ShareRecipeSheet visible={shareSheetOpen} onDismiss={() => setShareSheetOpen(false)} recipe={recipe} />
      <ContinueIteratingSheet visible={continueSheetOpen} onDismiss={() => setContinueSheetOpen(false)} recipe={recipe} />

      <BottomSheet visible={videoEditOpen} onDismiss={() => setVideoEditOpen(false)}>
        <Text style={styles.videoEditTitle}>Video link</Text>
        <TextInput
          value={videoInput}
          onChangeText={setVideoInput}
          placeholder="Paste a TikTok, Instagram, or YouTube link"
          autoCapitalize="none"
          style={styles.videoInput}
        />
        <View style={styles.videoEditActions}>
          <PressableScale onPress={() => setVideoEditOpen(false)} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Cancel</Text>
          </PressableScale>
          {recipe.video_url ? (
            <PressableScale onPress={handleRemoveVideo} style={styles.actionButton}>
              <Text style={[styles.actionButtonText, { color: colors.danger }]}>Remove</Text>
            </PressableScale>
          ) : null}
          <PressableScale onPress={handleSaveVideo} style={styles.primaryActionButton}>
            <Text style={styles.primaryActionButtonText}>Save</Text>
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
  meta: {
    color: colors.subtext,
    fontSize: 13.5,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addVideoRow: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairline,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addVideoText: {
    color: colors.subtext,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
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
    gap: 8,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: spacing.radiusPill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: colors.foreground,
    fontFamily: fontFamily.bold,
    fontSize: 13,
  },
  primaryActionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 10,
  },
  primaryActionButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 13,
  },
  sectionKicker: {
    fontFamily: typography.sectionKicker.fontFamily,
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  videoEditTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
    marginBottom: 12,
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
    gap: 8,
    marginTop: 16,
  },
});
