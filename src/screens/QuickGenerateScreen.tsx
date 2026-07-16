import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PressableScale } from '../components/PressableScale';
import { IngredientsList } from '../components/IngredientsList';
import { StepsList } from '../components/StepsList';
import { useAppContext } from '../navigation/AppContext';
import { createRecipeViaBackend } from '../api/backend';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';
import type { DifficultyOption, Recipe, TimeOption, VibeOption } from '../types';
import type { RootStackParamList } from '../types/navigation';

const timeChoices: TimeOption[] = [15, 30, 45];
const difficultyChoices: DifficultyOption[] = ['easy', 'medium'];

// design doc §7: icons must match their labels — the old Tonight screen had
// leaf/potato/chestnut/noodle icons on Comfort/Fresh/High-Protein/Light, a
// known bug. This is the corrected 2x2 set.
const vibeItems: Array<{ key: VibeOption; label: string; icon: string }> = [
  { key: 'comfort', label: 'Comfort', icon: '🍲' },
  { key: 'fresh', label: 'Fresh', icon: '🥗' },
  { key: 'high-protein', label: 'High-Protein', icon: '🍗' },
  { key: 'light', label: 'Light', icon: '🥣' },
];

export function QuickGenerateScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isGenerating, startGenerationRun, hydrateRun, generatedRuns, getRecipeForRun } = useAppContext();
  const [time, setTime] = useState<TimeOption>(30);
  const [vibe, setVibe] = useState<VibeOption>('comfort');
  const [difficulty, setDifficulty] = useState<DifficultyOption>('easy');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const activeRun = generatedRuns.find((run) => run.id === activeRunId) ?? null;

  const handleGenerate = async () => {
    const runId = await startGenerationRun({ time, vibe, difficulty });
    setActiveRunId(runId);
    void hydrateRun(runId);
  };

  const handleSave = async (recipe: Recipe) => {
    setSavedIds((prev) => [...prev, recipe.id]);
    await createRecipeViaBackend({
      title: recipe.title,
      cuisine: recipe.cuisine,
      servings: recipe.servings,
      total_time_minutes: recipe.total_time_minutes,
      difficulty: recipe.difficulty,
      short_hook: recipe.short_hook,
      dietary_tags: recipe.dietary_tags,
      allergen_warnings: recipe.allergen_warnings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      source_type: 'generated',
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>‹ Close</Text>
        </PressableScale>

        <Text style={styles.hero}>What sounds good tonight?</Text>
        <Text style={styles.subhero}>A quick idea from Meno — no AI connection needed</Text>

        <View style={styles.vibeGrid}>
          {vibeItems.map((item) => {
            const active = item.key === vibe;
            return (
              <PressableScale
                key={item.key}
                onPress={() => setVibe(item.key)}
                style={[styles.vibeTile, active && styles.vibeTileActive]}
              >
                <Text style={styles.vibeIcon}>{item.icon}</Text>
                <Text style={[styles.vibeLabel, active && styles.vibeLabelActive]}>{item.label}</Text>
              </PressableScale>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Time</Text>
        <View style={styles.pillRow}>
          {timeChoices.map((option) => (
            <PressableScale
              key={option}
              onPress={() => setTime(option)}
              style={[styles.pill, option === time && styles.pillActive]}
            >
              <Text style={[styles.pillText, option === time && styles.pillTextActive]}>{option} min</Text>
            </PressableScale>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Difficulty</Text>
        <View style={styles.pillRow}>
          {difficultyChoices.map((option) => (
            <PressableScale
              key={option}
              onPress={() => setDifficulty(option)}
              style={[styles.pill, option === difficulty && styles.pillActive]}
            >
              <Text style={[styles.pillText, option === difficulty && styles.pillTextActive]}>
                {option === 'easy' ? 'Easy' : 'Medium'}
              </Text>
            </PressableScale>
          ))}
        </View>

        <PressableScale onPress={handleGenerate} style={styles.generateButton}>
          {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateButtonText}>Give me 3 ideas</Text>}
        </PressableScale>
        <Text style={styles.finePrint}>Uses Meno&apos;s built-in model — counts toward your monthly quota.</Text>

        {activeRun ? (
          <View style={styles.results}>
            {activeRun.summaries.map((summary) => {
              const recipe = getRecipeForRun(activeRun.id, summary.id);
              const status = activeRun.statusById[summary.id] ?? 'pending';
              const expanded = expandedRecipeId === summary.id;
              return (
                <View key={summary.id} style={styles.resultCard}>
                  <PressableScale
                    onPress={() => recipe && setExpandedRecipeId(expanded ? null : summary.id)}
                    style={styles.resultCardHeader}
                  >
                    <Text style={styles.resultTitle}>{summary.title}</Text>
                    <Text style={styles.resultMeta}>
                      {status === 'pending' ? 'Finishing recipe…' : `${summary.total_time_minutes} min · ${summary.cuisine}`}
                    </Text>
                  </PressableScale>
                  {expanded && recipe ? (
                    <View style={styles.resultDetail}>
                      <IngredientsList ingredients={recipe.ingredients} />
                      <StepsList steps={recipe.steps} />
                      <PressableScale
                        onPress={() => handleSave(recipe)}
                        style={[styles.saveButton, savedIds.includes(recipe.id) && styles.saveButtonDisabled]}
                      >
                        <Text style={styles.saveButtonText}>
                          {savedIds.includes(recipe.id) ? 'Saved ✓' : 'Save to Cookbook'}
                        </Text>
                      </PressableScale>
                    </View>
                  ) : null}
                </View>
              );
            })}
            <Text style={styles.connectHint}>
              Connect Claude or ChatGPT for richer, versioned results next time — coming soon.
            </Text>
          </View>
        ) : null}
      </ScrollView>
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
    gap: 10,
  },
  closeButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  closeButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
  },
  hero: {
    fontFamily: typography.screenTitle.fontFamily,
    color: colors.foreground,
    fontSize: 26,
  },
  subhero: {
    color: colors.subtext,
    fontSize: 13.5,
    marginBottom: 16,
  },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  vibeTile: {
    width: '47%',
    minHeight: 92,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: spacing.radiusCard,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...elevation.card,
  },
  vibeTileActive: {
    backgroundColor: colors.matBackground,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  vibeIcon: {
    fontSize: 28,
  },
  vibeLabel: {
    color: colors.subtext,
    fontFamily: fontFamily.bold,
    fontSize: 13,
    textAlign: 'center',
  },
  vibeLabelActive: {
    color: colors.accent,
  },
  sectionLabel: {
    color: colors.subtext,
    fontSize: 11,
    fontFamily: fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    borderRadius: spacing.radiusPill,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pillActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  pillText: {
    color: colors.subtext,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
  pillTextActive: {
    color: '#fff',
  },
  generateButton: {
    marginTop: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 16,
  },
  generateButtonText: {
    color: '#fff',
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
  },
  finePrint: {
    color: colors.subtext,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 6,
  },
  results: {
    marginTop: 24,
    gap: 10,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: spacing.radiusCard,
    padding: 14,
    ...elevation.card,
  },
  resultCardHeader: {
    gap: 2,
  },
  resultTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
  resultMeta: {
    color: colors.subtext,
    fontSize: 12.5,
  },
  resultDetail: {
    marginTop: 12,
    gap: 12,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.accent2,
    borderRadius: spacing.radiusPill,
    paddingVertical: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 13,
  },
  connectHint: {
    color: colors.subtext,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
