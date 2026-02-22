import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import type { Recipe } from '../types';
import { colors } from '../theme/colors';
import { Chip } from './Chip';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
  onLongPress?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onRemove?: () => void;
  compact?: boolean;
  selected?: boolean;
  modeStyle?: 'browse' | 'select' | 'reorder';
  showReorderDeleteX?: boolean;
  onReorderDelete?: () => void;
}

export function RecipeCard({
  recipe,
  onPress,
  onLongPress,
  onSave,
  onShare,
  onRemove,
  compact = false,
  selected = false,
  modeStyle = 'browse',
  showReorderDeleteX,
  onReorderDelete,
}: RecipeCardProps) {
  const tags = recipe.dietary_tags.slice(0, 3);
  const stopPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
  };

  return (
    <Pressable
      style={[
        styles.card,
        compact && styles.compactCard,
        selected && styles.cardSelected,
        modeStyle === 'reorder' && styles.reorderCard,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={180}
    >
      <View style={[styles.image, compact && styles.compactImage]}>
        <Text style={styles.imageEmoji}>{compact ? '🥗' : '🍽️'}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
        <Text style={styles.meta}>{recipe.total_time_minutes} min · {recipe.difficulty}</Text>
        <View style={styles.tags}>
          {tags.map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </View>
        <Text style={styles.hook} numberOfLines={1}>{recipe.short_hook}</Text>
      </View>

      {showReorderDeleteX && onReorderDelete ? (
        <Pressable
          style={styles.reorderDelete}
          onPress={(event) => {
            stopPress(event);
            onReorderDelete();
          }}
        >
          <Text style={styles.reorderDeleteText}>×</Text>
        </Pressable>
      ) : null}

      {onSave || onShare || onRemove ? (
        <View style={styles.actions}>
          {onSave ? (
            <Pressable
              style={styles.saveButton}
              onPress={(event) => {
                stopPress(event);
                onSave();
              }}
            >
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          ) : null}
          {onShare ? (
            <Pressable
              style={styles.saveButton}
              onPress={(event) => {
                stopPress(event);
                onShare();
              }}
            >
              <Text style={styles.saveText}>Share</Text>
            </Pressable>
          ) : null}
          {onRemove ? (
            <Pressable
              style={styles.saveButton}
              onPress={(event) => {
                stopPress(event);
                onRemove();
              }}
            >
              <Text style={styles.saveText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  compactCard: {
    flexDirection: 'column',
  },
  reorderCard: {
    paddingTop: 20,
  },
  cardSelected: {
    borderColor: colors.primaryAccent,
    backgroundColor: '#FFF7F5',
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: '#F1E5D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactImage: {
    width: '100%',
    height: 100,
  },
  imageEmoji: {
    fontSize: 36,
  },
  content: {
    flex: 1,
    gap: 7,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 27,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  hook: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  saveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.secondaryAccent,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actions: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  saveText: {
    color: colors.secondaryAccent,
    fontWeight: '700',
    fontSize: 13,
  },
  reorderDelete: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2B0A9',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  reorderDeleteText: {
    color: colors.danger,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: -1,
  },
});
