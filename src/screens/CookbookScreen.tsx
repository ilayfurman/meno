import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CookbookRecipeCard } from '../components/CookbookRecipeCard';
import { SearchBar } from '../components/SearchBar';
import { PressableScale } from '../components/PressableScale';
import { BottomSheet } from '../components/BottomSheet';
import { ImportRecipeSheet } from '../components/ImportRecipeSheet';
import { getCookbookCuisinesViaBackend, getCookbookViaBackend, setFavoriteViaBackend } from '../api/backend';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';
import type { CookbookListItem, StoredRecipe } from '../types';
import type { CookbookFilter, CookbookSortKey } from '../types/cookbook';
import type { RootStackParamList } from '../types/navigation';

const sortOptions: Array<{ key: CookbookSortKey; label: string }> = [
  { key: 'recent', label: 'Recently saved' },
  { key: 'title_asc', label: 'A-Z' },
  { key: 'time_asc', label: 'Time low-high' },
  { key: 'time_desc', label: 'Time high-low' },
];

// A clean multiple of the 2-column grid (12 full rows) -- big enough that
// casual browsing rarely feels paginated, small enough that opening the
// screen with a couple hundred recipes saved doesn't pull them all down
// (and doesn't pull down every version's full ingredients/steps either,
// since /v1/cookbook now returns the lean CookbookListItem shape).
const PAGE_SIZE = 24;

function toListItem(recipe: StoredRecipe): CookbookListItem {
  return {
    id: recipe.id,
    title: recipe.title,
    cuisine: recipe.cuisine,
    servings: recipe.servings,
    total_time_minutes: recipe.total_time_minutes,
    image_url: recipe.image_url,
    is_favorite: recipe.is_favorite,
    version_count: recipe.versions.length,
    current_version_number: recipe.current_version.version_number,
  };
}

export function CookbookScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [recipes, setRecipes] = useState<CookbookListItem[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced so typing doesn't fire a request per keystroke -- the network
  // call itself carries the search/filter/sort params (see loadCookbook
  // below), so this is the only thing standing between a keypress and a
  // request going out.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<CookbookFilter>('all');
  const [sortBy, setSortBy] = useState<CookbookSortKey>('recent');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  // True until we've shown *something* -- so the empty state never flashes
  // "No recipes match" while the very first fetch is still in flight.
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Search/filter/sort all run server-side (see listCookbookPage on the
  // backend) -- this fetches page 1 of whatever the CURRENT query matches,
  // same as re-searching from scratch. Recreated whenever those params
  // change, and useFocusEffect below re-invokes it both on a real focus
  // event and immediately whenever this identity changes while already
  // focused (e.g. typing in the search box), so there's no separate effect
  // needed to react to param changes.
  const loadCookbook = useCallback(async () => {
    try {
      const page = await getCookbookViaBackend({
        limit: PAGE_SIZE,
        offset: 0,
        search: debouncedSearch,
        filter: activeFilter,
        sort: sortBy,
      });
      setRecipes(page.recipes);
      setOffset(page.recipes.length);
      setHasMore(page.hasMore);
    } catch (err) {
      // Leave prior state on load failure -- a toast/retry affordance can be
      // added later -- but at least log it. This used to fail completely
      // silently, which is how an auth-identity bug (recipes appearing to
      // vanish) went unnoticed instead of showing up as a visible error.
      console.error('Failed to load cookbook:', err);
    } finally {
      setIsInitialLoading(false);
    }
  }, [debouncedSearch, activeFilter, sortBy]);

  useFocusEffect(
    useCallback(() => {
      void loadCookbook();
    }, [loadCookbook]),
  );

  const loadCuisines = useCallback(async () => {
    try {
      setCuisines(await getCookbookCuisinesViaBackend());
    } catch (err) {
      console.error('Failed to load cuisine list:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCuisines();
    }, [loadCuisines]),
  );

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || isInitialLoading) return;
    setIsLoadingMore(true);
    try {
      const page = await getCookbookViaBackend({
        limit: PAGE_SIZE,
        offset,
        search: debouncedSearch,
        filter: activeFilter,
        sort: sortBy,
      });
      setRecipes((prev) => [...prev, ...page.recipes]);
      setOffset((prev) => prev + page.recipes.length);
      setHasMore(page.hasMore);
    } catch (err) {
      console.error('Failed to load more recipes:', err);
      // Stop auto-retrying against a broken connection -- the user can
      // trigger another attempt by scrolling again once things recover.
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [offset, hasMore, isLoadingMore, isInitialLoading, debouncedSearch, activeFilter, sortBy]);

  const handleToggleFavorite = async (recipe: CookbookListItem) => {
    const next = !recipe.is_favorite;
    if (activeFilter === 'favorites' && !next) {
      // No longer matches the Favorites filter -- drop it from view right
      // away instead of leaving a now-wrong item sitting in the list.
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    } else {
      setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, is_favorite: next } : r)));
    }
    try {
      await setFavoriteViaBackend(recipe.id, next);
    } catch {
      // Simplest correct recovery: re-fetch the current page fresh rather
      // than trying to reconstruct exactly what was optimistically changed.
      void loadCookbook();
    }
  };

  const sortLabel = sortOptions.find((o) => o.key === sortBy)?.label ?? 'Sort';

  return (
    <View style={styles.screen}>
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListHeaderComponent={
          <View>
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
            </View>

            <View style={styles.sortRow}>
              <Text style={styles.sortRowLabel}>Sort by</Text>
              <PressableScale onPress={() => setSortSheetOpen(true)} style={styles.sortControl} scaleTo={0.96}>
                <Text style={styles.sortControlIcon}>⇅</Text>
                <Text style={styles.sortControlText}>{sortLabel}</Text>
                <Text style={styles.sortControlChevron}>⌄</Text>
              </PressableScale>
            </View>
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
          isInitialLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <Text style={styles.emptyText}>No recipes match — try a different search or filter.</Text>
          )
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMoreWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
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
        onImported={(recipe) => {
          setRecipes((prev) => [toListItem(recipe), ...prev]);
          // Keeps the next loadMore() call's offset lined up with the
          // server, which just gained one more row ahead of that cursor.
          setOffset((prev) => prev + 1);
        }}
        onViewExisting={(recipeId) => navigation.navigate('RecipeDetail', { recipeId })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
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
  title: {
    fontFamily: typography.screenTitle.fontFamily,
    color: colors.foreground,
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: 14,
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
    fontFamily: fontFamily.semiBold,
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
    fontFamily: fontFamily.semiBold,
  },
  filterPillTextActive: {
    color: '#fff',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sortRowLabel: {
    color: colors.subtext,
    fontSize: 11,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sortControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: spacing.radiusPill,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...elevation.card,
  },
  sortControlIcon: {
    color: colors.accent,
    fontSize: 13,
  },
  sortControlText: {
    color: colors.foreground,
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
  },
  sortControlChevron: {
    color: colors.subtext,
    fontSize: 11,
  },
  emptyText: {
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 40,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingMoreWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  sortOptionRow: {
    paddingVertical: 14,
  },
  sortOptionText: {
    fontSize: 15,
    color: colors.foreground,
    fontFamily: fontFamily.semiBold,
  },
  sortOptionTextActive: {
    color: colors.accent,
  },
});
