import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SearchBar } from '../components/SearchBar';
import { RecipeCard } from '../components/RecipeCard';
import { askAboutRecipes } from '../ai/openai';
import {
  getCookbook,
  removeRecipeFromCookbook,
  removeRecipesFromCookbook,
  setCookbookOrder,
} from '../storage/cookbook';
import { buildMultiRecipeShare } from '../utils/recipeShare';
import { colors } from '../theme/colors';
import type { Recipe } from '../types';
import type { RootStackParamList } from '../types/navigation';
import type {
  ChatMessage,
  CookbookFilterState,
  CookbookMode,
  CookbookQuickFilter,
  CookbookSortKey,
} from '../types/cookbook';
import { defaultCookbookFilters } from '../types/cookbook';
import { CookbookFilterSheet } from '../components/CookbookFilterSheet';
import { AppliedFilterChips, type AppliedChip } from '../components/AppliedFilterChips';
import { FloatingAgentButton } from '../components/FloatingAgentButton';
import { CookbookAgentOverlay } from '../components/CookbookAgentOverlay';

const NativeBlurView =
  // Optional runtime blur if expo-blur is installed; fallback style used otherwise.
  ((): React.ComponentType<any> | null => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('expo-blur').BlurView;
    } catch {
      return null;
    }
  })();

function moveBefore(list: Recipe[], fromId: string, targetId: string): Recipe[] {
  const fromIndex = list.findIndex((item) => item.id === fromId);
  const targetIndex = list.findIndex((item) => item.id === targetId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) {
    return list;
  }

  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  const adjustedTarget = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
  next.splice(adjustedTarget, 0, item);
  return next;
}

function quickFilterLabel(key: CookbookQuickFilter): string {
  if (key === 'quick') return 'Quick <=30';
  if (key === 'comfort') return 'Comfort';
  if (key === 'gf') return 'GF';
  if (key === 'veg') return 'Veg';
  return 'Favorites';
}

function sortLabel(key: CookbookSortKey): string {
  if (key === 'title_asc') return 'A-Z';
  if (key === 'time_asc') return 'Time: low-high';
  if (key === 'time_desc') return 'Time: high-low';
  return 'Recently saved';
}

function buildAppliedChips(
  appliedFilters: CookbookFilterState,
  sortBy: CookbookSortKey,
  setAppliedFilters: (next: CookbookFilterState) => void,
  setSortBy: (next: CookbookSortKey) => void,
): AppliedChip[] {
  const chips: AppliedChip[] = [];

  if (sortBy !== 'recent') {
    chips.push({
      key: `sort:${sortBy}`,
      label: sortLabel(sortBy),
      onRemove: () => setSortBy('recent'),
    });
  }

  appliedFilters.quick.forEach((key) => {
    chips.push({
      key: `quick:${key}`,
      label: quickFilterLabel(key),
      onRemove: () =>
        setAppliedFilters({
          ...appliedFilters,
          quick: appliedFilters.quick.filter((item) => item !== key),
        }),
    });
  });

  appliedFilters.difficulty.forEach((key) => {
    chips.push({
      key: `difficulty:${key}`,
      label: key,
      onRemove: () =>
        setAppliedFilters({
          ...appliedFilters,
          difficulty: appliedFilters.difficulty.filter((item) => item !== key),
        }),
    });
  });

  appliedFilters.cuisines.forEach((key) => {
    chips.push({
      key: `cuisine:${key}`,
      label: key,
      onRemove: () =>
        setAppliedFilters({
          ...appliedFilters,
          cuisines: appliedFilters.cuisines.filter((item) => item !== key),
        }),
    });
  });

  return chips;
}

export function CookbookScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<CookbookMode>('browse');
  const [reorderFromId, setReorderFromId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<CookbookFilterState>(defaultCookbookFilters);
  const [appliedFilters, setAppliedFilters] = useState<CookbookFilterState>(defaultCookbookFilters);
  const [pendingSortBy, setPendingSortBy] = useState<CookbookSortKey>('recent');
  const [sortBy, setSortBy] = useState<CookbookSortKey>('recent');
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>([]);
  const [agentInput, setAgentInput] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSelectedContextIds, setAgentSelectedContextIds] = useState<string[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const selectDockBottomPad = Math.max(insets.bottom + 2, 8);
  const selectDockHeight = Math.max(insets.bottom + 72, 86);

  const reloadCookbook = useCallback(() => {
    let mounted = true;
    void getCookbook().then((items) => {
      if (mounted) {
        setRecipes(items);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(reloadCookbook);

  const filteredAndSorted = useMemo(() => {
    let result = recipes.filter((recipe) => recipe.title.toLowerCase().includes(search.toLowerCase().trim()));

    const quickFilters = new Set(appliedFilters.quick);
    if (quickFilters.has('quick')) {
      result = result.filter((recipe) => recipe.total_time_minutes <= 30);
    }
    if (quickFilters.has('comfort')) {
      result = result.filter((recipe) => recipe.short_hook.toLowerCase().includes('comfort'));
    }
    if (quickFilters.has('gf')) {
      result = result.filter((recipe) => {
        const tags = recipe.dietary_tags.map((tag) => tag.toLowerCase());
        return tags.some((tag) => tag.includes('gluten') || tag === 'gf');
      });
    }
    if (quickFilters.has('veg')) {
      result = result.filter((recipe) => recipe.dietary_tags.some((tag) => tag.toLowerCase().includes('veg')));
    }

    if (appliedFilters.difficulty.length > 0) {
      const allowed = new Set(appliedFilters.difficulty.map((item) => item.toLowerCase()));
      result = result.filter((recipe) => allowed.has(recipe.difficulty.toLowerCase()));
    }

    if (appliedFilters.cuisines.length > 0) {
      const allowed = new Set(appliedFilters.cuisines.map((item) => item.toLowerCase()));
      result = result.filter((recipe) => allowed.has(recipe.cuisine.toLowerCase()));
    }

    if (sortBy === 'title_asc') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'time_asc') {
      result = [...result].sort((a, b) => a.total_time_minutes - b.total_time_minutes);
    } else if (sortBy === 'time_desc') {
      result = [...result].sort((a, b) => b.total_time_minutes - a.total_time_minutes);
    }

    return result;
  }, [recipes, search, appliedFilters, sortBy]);

  const selectedRecipes = useMemo(
    () => recipes.filter((recipe) => selectedIds.includes(recipe.id)),
    [recipes, selectedIds],
  );

  const displayRecipes = mode === 'reorder' ? recipes : filteredAndSorted;

  const appliedChips = useMemo(
    () => buildAppliedChips(appliedFilters, sortBy, setAppliedFilters, setSortBy),
    [appliedFilters, sortBy],
  );

  const resetModeState = () => {
    setSelectedIds([]);
    setReorderFromId(null);
  };

  const setCookbookMode = (next: CookbookMode) => {
    setMode(next);
    resetModeState();
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const persistAndSetRecipes = (next: Recipe[]) => {
    setRecipes(next);
    void setCookbookOrder(next);
  };

  const onCardPress = (recipe: Recipe) => {
    if (mode === 'reorder') {
      if (!reorderFromId) {
        setReorderFromId(recipe.id);
        return;
      }
      if (reorderFromId === recipe.id) {
        setReorderFromId(null);
        return;
      }
      const next = moveBefore(recipes, reorderFromId, recipe.id);
      setReorderFromId(null);
      persistAndSetRecipes(next);
      return;
    }

    if (mode === 'select') {
      toggleSelected(recipe.id);
      return;
    }

    navigation.navigate('RecipeDetail', {
      recipe,
      requestId: 'cookbook',
      request: { time: 30, vibe: 'comfort', difficulty: 'easy' },
    });
  };

  const onCardLongPress = (recipeId: string) => {
    if (mode !== 'browse') {
      return;
    }
    setMode('select');
    setSelectedIds([recipeId]);
  };

  const onShareSelected = async () => {
    if (!selectedRecipes.length) {
      Alert.alert('No selection', 'Select at least one recipe.');
      return;
    }
    try {
      await Share.share({
        title: 'Meno Cookbook Recipes',
        message: buildMultiRecipeShare(selectedRecipes),
      });
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  };

  const onDeleteSingle = (id: string) => {
    Alert.alert('Remove recipe', 'Remove this recipe from cookbook?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeRecipeFromCookbook(id).then(() => {
            setRecipes((prev) => prev.filter((recipe) => recipe.id !== id));
            setSelectedIds((prev) => prev.filter((item) => item !== id));
            if (reorderFromId === id) {
              setReorderFromId(null);
            }
          });
        },
      },
    ]);
  };

  const onDeleteSelected = () => {
    if (!selectedIds.length) {
      Alert.alert('No selection', 'Select recipes to remove.');
      return;
    }
    Alert.alert('Remove selected', `Remove ${selectedIds.length} selected recipe(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeRecipesFromCookbook(selectedIds).then(() => {
            setRecipes((prev) => prev.filter((recipe) => !selectedIds.includes(recipe.id)));
            setSelectedIds([]);
          });
        },
      },
    ]);
  };

  const openAgent = () => {
    setAgentSelectedContextIds(selectedIds);
    setAgentOpen(true);
  };

  const askAgent = async () => {
    if (!agentInput.trim()) {
      Alert.alert('Question required', 'Type a question first.');
      return;
    }

    const contextRecipes =
      agentSelectedContextIds.length > 0
        ? recipes.filter((recipe) => agentSelectedContextIds.includes(recipe.id))
        : recipes.slice(0, 6);

    if (contextRecipes.length === 0) {
      Alert.alert('No recipes available', 'Save recipes first or select recipes before opening the agent.');
      return;
    }

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: agentInput.trim(),
      ts: Date.now(),
    };

    setAgentMessages((prev) => [...prev, userMessage]);
    setAgentInput('');

    try {
      setAgentLoading(true);
      const answer = await askAboutRecipes(userMessage.text, contextRecipes);
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: 'assistant',
        text: answer,
        ts: Date.now(),
      };
      setAgentMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const fallback: ChatMessage = {
        id: `a-${Date.now()}-error`,
        role: 'assistant',
        text: error instanceof Error ? error.message : 'Agent failed unexpectedly.',
        ts: Date.now(),
      };
      setAgentMessages((prev) => [...prev, fallback]);
    } finally {
      setAgentLoading(false);
    }
  };

  const applyFilters = () => {
    setAppliedFilters(pendingFilters);
    setSortBy(pendingSortBy);
    setFilterSheetOpen(false);
  };

  const clearFilters = () => {
    setPendingFilters(defaultCookbookFilters);
    setPendingSortBy('recent');
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Cookbook</Text>
          <View style={styles.topActions}>
            <Pressable
              style={[styles.headerButton, mode === 'select' && styles.headerButtonActive]}
              onPress={() => setCookbookMode(mode === 'select' ? 'browse' : 'select')}
            >
              <Text style={styles.headerButtonText}>{mode === 'select' ? 'Done' : 'Select'}</Text>
            </Pressable>
            <Pressable
              style={[styles.headerButton, mode === 'reorder' && styles.headerButtonActive]}
              onPress={() => setCookbookMode(mode === 'reorder' ? 'browse' : 'reorder')}
            >
              <Text style={styles.headerButtonText}>{mode === 'reorder' ? 'Done' : 'Reorder'}</Text>
            </Pressable>
          </View>
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search your cookbook" />

        <View style={styles.filterRow}>
          <Pressable style={styles.filterTrigger} onPress={() => setFilterSheetOpen(true)}>
            <Text style={styles.filterTriggerText}>Filter</Text>
          </Pressable>
          <Pressable style={styles.filterTrigger} onPress={() => setFilterSheetOpen(true)}>
            <Text style={styles.filterTriggerText}>Sort: {sortLabel(sortBy)}</Text>
          </Pressable>
        </View>

        <AppliedFilterChips chips={appliedChips} />

        {mode === 'reorder' ? (
          <View style={styles.reorderHintCard}>
            <Text style={styles.reorderHint}>
              {reorderFromId
                ? 'Tap the recipe you want to place this before.'
                : 'Tap a recipe to pick it up, then tap another recipe to place it.'}
            </Text>
            {reorderFromId ? (
              <Pressable style={styles.clearPickButton} onPress={() => setReorderFromId(null)}>
                <Text style={styles.clearPickText}>Clear selection</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {displayRecipes.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyTitle}>No saved recipes yet</Text>
            <Text style={styles.emptyBody}>Save from Results or Recipe Detail to build your cookbook.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {displayRecipes.map((recipe) => {
              const selected = selectedIds.includes(recipe.id) || reorderFromId === recipe.id;
              return (
                <View key={recipe.id} style={styles.gridItem}>
                  <RecipeCard
                    recipe={recipe}
                    compact
                    selected={selected}
                    modeStyle={mode}
                    onPress={() => onCardPress(recipe)}
                    onLongPress={() => onCardLongPress(recipe.id)}
                    showReorderDeleteX={mode === 'reorder'}
                    onReorderDelete={mode === 'reorder' ? () => onDeleteSingle(recipe.id) : undefined}
                  />
                  {mode === 'reorder' ? (
                    <View style={styles.reorderBadge}>
                      <Text style={styles.reorderBadgeText}>{reorderFromId === recipe.id ? 'Picked' : 'Tap to move'}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>

      {mode === 'select' ? (
        <View
          style={[
            styles.selectActionDock,
            {
              paddingBottom: selectDockBottomPad,
              height: selectDockHeight,
            },
          ]}
        >
          {NativeBlurView ? (
            <NativeBlurView tint="light" intensity={58} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.selectActionFallbackBg]} />
          )}
          <View style={styles.selectActionRow}>
            <Pressable
              style={[styles.selectActionButton, selectedIds.length === 0 && styles.selectActionDisabled]}
              onPress={() => void onShareSelected()}
            >
              <View style={styles.shareGlyphBox}>
                <Text style={styles.shareGlyphArrow}>↑</Text>
              </View>
            </Pressable>
            <Pressable
              style={[
                styles.selectActionButton,
                styles.selectDeleteButton,
                selectedIds.length === 0 && styles.selectActionDisabled,
              ]}
              onPress={onDeleteSelected}
            >
              <View style={styles.trashGlyph}>
                <View style={styles.trashLid} />
                <View style={styles.trashBody}>
                  <View style={styles.trashLine} />
                  <View style={styles.trashLine} />
                  <View style={styles.trashLine} />
                </View>
              </View>
            </Pressable>

            <Text style={[styles.selectCountText, { bottom: selectDockBottomPad + 10 }]}>
              {selectedIds.length > 0 ? `${selectedIds.length} Recipes Selected` : 'Select Recipes'}
            </Text>
          </View>
        </View>
      ) : null}

      {mode !== 'select' ? <FloatingAgentButton onPress={openAgent} bottom={Math.max(insets.bottom + 56, 70)} /> : null}

      <CookbookAgentOverlay
        visible={agentOpen}
        onClose={() => setAgentOpen(false)}
        messages={agentMessages}
        input={agentInput}
        onInputChange={setAgentInput}
        onSend={() => void askAgent()}
        loading={agentLoading}
        selectedCount={agentSelectedContextIds.length}
        onQuickPrompt={setAgentInput}
      />

      <CookbookFilterSheet
        visible={filterSheetOpen}
        onClose={() => {
          setPendingFilters(appliedFilters);
          setPendingSortBy(sortBy);
          setFilterSheetOpen(false);
        }}
        pendingFilters={pendingFilters}
        setPendingFilters={setPendingFilters}
        pendingSort={pendingSortBy}
        setPendingSort={setPendingSortBy}
        onApply={applyFilters}
        onClear={clearFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 128,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 33,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  headerButtonActive: {
    borderColor: colors.primaryAccent,
    backgroundColor: '#FFF5F3',
  },
  headerButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTrigger: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterTriggerText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  reorderHintCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    gap: 8,
  },
  reorderHint: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  clearPickButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clearPickText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  gridItem: {
    width: '48.5%',
    position: 'relative',
  },
  reorderBadge: {
    position: 'absolute',
    right: 8,
    top: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reorderBadgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  selectActionDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 0,
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  selectActionFallbackBg: {
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  selectCountText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  selectActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  selectActionButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  selectActionDisabled: {
    opacity: 0.45,
  },
  selectDeleteButton: {
    borderColor: '#E8DFD8',
  },
  shareGlyphBox: {
    width: 20,
    height: 16,
    borderWidth: 1.6,
    borderColor: colors.textPrimary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 1,
  },
  shareGlyphArrow: {
    position: 'absolute',
    top: -9,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  trashGlyph: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashLid: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
    marginBottom: 1,
  },
  trashBody: {
    width: 15,
    height: 14,
    borderWidth: 1.6,
    borderTopWidth: 1.6,
    borderColor: colors.textPrimary,
    borderRadius: 2,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  trashLine: {
    width: 1.4,
    height: 7,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
  },
});
