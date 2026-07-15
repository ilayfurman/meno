import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CookbookRecipeCard } from '../components/CookbookRecipeCard';
import { SearchBar } from '../components/SearchBar';
import { PressableScale } from '../components/PressableScale';
import { BottomSheet } from '../components/BottomSheet';
import { ImportRecipeSheet } from '../components/ImportRecipeSheet';
import { getCookbookViaBackend, setFavoriteViaBackend } from '../api/backend';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { StoredRecipe } from '../types';
import type { CookbookFilter, CookbookSortKey } from '../types/cookbook';
import type { RootStackParamList } from '../types/navigation';

const sortOptions: Array<{ key: CookbookSortKey; label: string }> = [
  { key: 'recent', label: 'Recently saved' },
  { key: 'title_asc', label: 'A-Z' },
  { key: 'time_asc', label: 'Time low-high' },
  { key: 'time_desc', label: 'Time high-low' },
];

export function CookbookScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CookbookFilter>('all');
  const [sortBy, setSortBy] = useState<CookbookSortKey>('recent');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [importSheetOpen, setImportSheetOpen] = useState(false);

  const loadCookbook = useCallback(async () => {
    try {
      const data = await getCookbookViaBackend();
      setRecipes(data);
    } catch {
      // leave prior state on load failure — a toast/retry affordance can be added later
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCookbook();
    }, [loadCookbook]),
  );

  const cuisines = useMemo(() => Array.from(new Set(recipes.map((r) => r.cuisine))).sort(), [recipes]);

  const visibleRecipes = useMemo(() => {
    let list = recipes;
    if (activeFilter === 'favorites') {
      list = list.filter((r) => r.is_favorite);
    } else if (activeFilter !== 'all') {
      list = list.filter((r) => r.cuisine === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortBy === 'title_asc') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'time_asc') {
      sorted.sort((a, b) => a.total_time_minutes - b.total_time_minutes);
    } else if (sortBy === 'time_desc') {
      sorted.sort((a, b) => b.total_time_minutes - a.total_time_minutes);
    }
    return sorted;
  }, [recipes, activeFilter, searchQuery, sortBy]);

  const showQuickGenerateCard = activeFilter === 'all' && searchQuery.trim() === '';

  const handleToggleFavorite = async (recipe: StoredRecipe) => {
    const next = !recipe.is_favorite;
    setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, is_favorite: next } : r)));
    try {
      await setFavoriteViaBackend(recipe.id, next);
    } catch {
      setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, is_favorite: !next } : r)));
    }
  };

  const sortLabel = sortOptions.find((o) => o.key === sortBy)?.label ?? 'Sort';

  return (
    <View style={styles.screen}>
      <FlatList
        data={visibleRecipes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListHeaderComponent={
          <View>
            <Text style={styles.kicker}>Cookbook</Text>
            <Text style={styles.title}>Everything you&apos;ve saved &amp; refined</Text>

            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search your cookbook" />
              </View>
              <PressableScale onPress={() => setImportSheetOpen(true)} style={styles.importButton}>
                <Text style={styles.importButtonText}>+</Text>
              </PressableScale>
            </View>

            <View style={styles.filterRow}>
              <PressableScale
                onPress={() => setActiveFilter('all')}
                style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>All</Text>
              </PressableScale>
              <PressableScale
                onPress={() => setActiveFilter('favorites')}
                style={[styles.filterPill, activeFilter === 'favorites' && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, activeFilter === 'favorites' && styles.filterPillTextActive]}>
                  Favorites
                </Text>
              </PressableScale>
              {cuisines.map((cuisine) => (
                <PressableScale
                  key={cuisine}
                  onPress={() => setActiveFilter(cuisine)}
                  style={[styles.filterPill, activeFilter === cuisine && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, activeFilter === cuisine && styles.filterPillTextActive]}>
                    {cuisine}
                  </Text>
                </PressableScale>
              ))}
              <PressableScale onPress={() => setSortSheetOpen(true)} style={styles.sortTrigger}>
                <Text style={styles.sortTriggerText}>{sortLabel} ⌄</Text>
              </PressableScale>
            </View>

            {showQuickGenerateCard ? (
              <PressableScale onPress={() => navigation.navigate('QuickGenerate')} style={styles.quickGenerateCard}>
                <Text style={styles.quickGenerateIcon}>✦</Text>
                <View style={styles.quickGenerateTextWrap}>
                  <Text style={styles.quickGenerateTitle}>No AI connected?</Text>
                  <Text style={styles.quickGenerateSubtitle}>Get 3 quick ideas from Meno, right now</Text>
                </View>
              </PressableScale>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <CookbookRecipeCard
              recipe={item}
              onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
              onToggleFavorite={() => handleToggleFavorite(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No recipes match — try a different search or filter.</Text>
        }
      />

      <BottomSheet visible={sortSheetOpen} onDismiss={() => setSortSheetOpen(false)}>
        {sortOptions.map((option) => (
          <PressableScale
            key={option.key}
            onPress={() => {
              setSortBy(option.key);
              setSortSheetOpen(false);
            }}
            style={styles.sortOptionRow}
          >
            <Text style={[styles.sortOptionText, option.key === sortBy && styles.sortOptionTextActive]}>
              {option.label}
            </Text>
          </PressableScale>
        ))}
      </BottomSheet>

      <ImportRecipeSheet
        visible={importSheetOpen}
        onDismiss={() => setImportSheetOpen(false)}
        onImported={(recipe) => setRecipes((prev) => [recipe, ...prev])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gridContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 120,
  },
  gridRow: {
    gap: spacing.gridGap,
  },
  gridItem: {
    flex: 1,
    marginBottom: spacing.gridGap,
  },
  kicker: {
    fontFamily: typography.sectionKicker.fontFamily,
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  title: {
    fontFamily: typography.screenTitle.fontFamily,
    color: colors.foreground,
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  searchInputWrap: {
    flex: 1,
  },
  importButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginTop: -2,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  filterPill: {
    borderRadius: spacing.radiusPill,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterPillActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  filterPillText: {
    color: colors.subtext,
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  sortTrigger: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sortTriggerText: {
    color: colors.subtext,
    fontSize: 13,
    fontWeight: '600',
  },
  quickGenerateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.matBackground,
    borderRadius: spacing.radiusCard,
    padding: 16,
    marginBottom: 16,
  },
  quickGenerateIcon: {
    fontSize: 22,
    color: colors.accent,
  },
  quickGenerateTextWrap: {
    flex: 1,
  },
  quickGenerateTitle: {
    color: colors.foreground,
    fontSize: 14.5,
    fontWeight: '700',
  },
  quickGenerateSubtitle: {
    color: colors.subtext,
    fontSize: 12.5,
    marginTop: 2,
  },
  emptyText: {
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 40,
  },
  sortOptionRow: {
    paddingVertical: 14,
  },
  sortOptionText: {
    fontSize: 15,
    color: colors.foreground,
    fontWeight: '600',
  },
  sortOptionTextActive: {
    color: colors.accent,
  },
});
