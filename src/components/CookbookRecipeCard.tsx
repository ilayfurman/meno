import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MattedPhoto } from './MattedPhoto';
import { PressableScale } from './PressableScale';
import { TagPill } from './TagPill';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/fonts';
import type { StoredRecipe } from '../types';

interface CookbookRecipeCardProps {
  recipe: StoredRecipe;
  onPress: () => void;
  onToggleFavorite: () => void;
}

export function CookbookRecipeCard({ recipe, onPress, onToggleFavorite }: CookbookRecipeCardProps) {
  return (
    <PressableScale onPress={onPress} style={styles.card} scaleTo={0.97}>
      <View>
        <MattedPhoto uri={null} aspectRatio={1} borderRadius={16} />
        {/* PressableScale forwards `style` to its inner Animated.View, not
            the outer Pressable that actually participates in layout --
            position:absolute has to live on a plain wrapping View, or the
            button falls into normal flow (right after the photo) instead
            of pinning to its top-right corner. Same bug fixed elsewhere
            this session (segmented toggle, back button). */}
        <View style={styles.favoriteButtonWrap}>
          <PressableScale onPress={onToggleFavorite} style={styles.favoriteButton}>
            <Text style={styles.favoriteIcon}>{recipe.is_favorite ? '♥' : '♡'}</Text>
          </PressableScale>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {recipe.title}
      </Text>
      <Text style={styles.meta}>
        {recipe.total_time_minutes} min · {recipe.cuisine}
      </Text>
      {recipe.versions.length > 1 ? (
        <View style={styles.tagRow}>
          <TagPill label={`v${recipe.current_version.version_number}`} variant="version" />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 6,
  },
  favoriteButtonWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  favoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteIcon: {
    color: colors.accent,
    fontSize: 16,
  },
  title: {
    color: colors.foreground,
    fontSize: 14.5,
    fontFamily: fontFamily.bold,
  },
  meta: {
    color: colors.subtext,
    fontSize: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
});
