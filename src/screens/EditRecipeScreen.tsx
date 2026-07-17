import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { PressableScale } from '../components/PressableScale';
import { addRecipeVersionViaBackend, getRecipeViaBackend, updateRecipeVersionViaBackend } from '../api/backend';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';
import type { Ingredient, RecipeStep, StoredRecipe } from '../types';
import type { RootStackParamList } from '../types/navigation';

type Route = RouteProp<RootStackParamList, 'EditRecipe'>;

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `k${Date.now()}-${keyCounter}`;
}

interface EditableIngredient extends Ingredient {
  key: string;
}

interface EditableStep {
  key: string;
  text: string;
  timer_seconds: number | null;
}

function toEditableIngredients(ingredients: Ingredient[]): EditableIngredient[] {
  return ingredients.map((ing) => ({ ...ing, key: nextKey() }));
}

function toEditableSteps(steps: RecipeStep[]): EditableStep[] {
  return steps.map((step) => ({ key: nextKey(), text: step.text, timer_seconds: step.timer_seconds ?? null }));
}

export function EditRecipeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { recipeId } = route.params;

  const [recipe, setRecipe] = useState<StoredRecipe | null>(null);
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([]);
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const loaded = await getRecipeViaBackend(recipeId);
    setRecipe(loaded);
    setIngredients(toEditableIngredients(loaded.current_version.ingredients));
    setSteps(toEditableSteps(loaded.current_version.steps));
  }, [recipeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateIngredient = (key: string, patch: Partial<Ingredient>) => {
    setIngredients((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeIngredient = (key: string) => {
    setIngredients((prev) => prev.filter((row) => row.key !== key));
  };

  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      {
        key: nextKey(),
        name: '',
        quantity: '',
        unit: '',
        notes: null,
        quantity_value: null,
        quantity_unit: null,
        quantity_text: null,
      },
    ]);
  };

  const updateStep = (key: string, text: string) => {
    setSteps((prev) => prev.map((row) => (row.key === key ? { ...row, text } : row)));
  };

  const removeStep = (key: string) => {
    setSteps((prev) => prev.filter((row) => row.key !== key));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { key: nextKey(), text: '', timer_seconds: null }]);
  };

  const saveChanges = async (mode: 'update' | 'new-version') => {
    if (!recipe) return;

    const cleanIngredients: Ingredient[] = ingredients
      .filter((row) => row.name.trim() !== '')
      .map(({ key: _key, ...rest }) => ({
        ...rest,
        name: rest.name.trim(),
        quantity: rest.quantity.trim(),
        unit: rest.unit.trim(),
        notes: rest.notes?.trim() ? rest.notes.trim() : null,
      }));

    const cleanSteps: RecipeStep[] = steps
      .filter((row) => row.text.trim() !== '')
      .map((row, index) => ({ idx: index + 1, text: row.text.trim(), timer_seconds: row.timer_seconds }));

    if (cleanIngredients.length === 0) {
      Alert.alert('Add at least one ingredient', 'The recipe needs at least one ingredient before you can save.');
      return;
    }
    if (cleanSteps.length === 0) {
      Alert.alert('Add at least one step', 'The recipe needs at least one step before you can save.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'update') {
        await updateRecipeVersionViaBackend(recipe.id, recipe.current_version.id!, {
          ingredients: cleanIngredients,
          steps: cleanSteps,
          change_note: changeNote.trim() || null,
        });
      } else {
        await addRecipeVersionViaBackend(recipe.id, {
          ingredients: cleanIngredients,
          steps: cleanSteps,
          change_note: changeNote.trim() || null,
          set_as_current: true,
        });
      }
      navigation.goBack();
    } catch (err) {
      console.error('Failed to save recipe edits:', err);
      Alert.alert('Something went wrong', "Your changes couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!recipe) return;
    // Only one version exists yet -- "new version vs. update this one" isn't
    // a real choice the first time around, so skip straight to updating it
    // in place rather than asking a question with an obvious answer.
    if (recipe.versions.length <= 1) {
      void saveChanges('update');
      return;
    }
    Alert.alert(
      'Save changes',
      `Update v${recipe.current_version.version_number} in place, or save these edits as a new version instead?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Update v${recipe.current_version.version_number}`, onPress: () => void saveChanges('update') },
        { text: 'Save as new version', onPress: () => void saveChanges('new-version') },
      ],
    );
  };

  if (!recipe) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.closeButtonAnchor}>
          <PressableScale onPress={() => navigation.goBack()} style={styles.closeButton} scaleTo={0.9}>
            <Text style={styles.closeButtonText}>✕</Text>
          </PressableScale>
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Edit recipe
        </Text>
        <View style={styles.saveButtonAnchor}>
          <PressableScale onPress={handleSave} style={styles.saveButton} disabled={saving} scaleTo={0.94}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
          </PressableScale>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            {recipe.versions.length > 1
              ? "When you save, you'll choose whether to update this version in place or keep it untouched and save these edits as a new version."
              : 'These changes update the recipe in place.'}
          </Text>

          <Text style={styles.sectionKicker}>Ingredients</Text>
          <View style={styles.sectionCard}>
            {ingredients.map((row) => (
              <View key={row.key} style={styles.ingredientRow}>
                <View style={styles.ingredientFieldsRow}>
                  <TextInput
                    value={row.quantity}
                    onChangeText={(text) => updateIngredient(row.key, { quantity: text })}
                    placeholder="1½"
                    style={[styles.input, styles.quantityInput]}
                  />
                  <TextInput
                    value={row.unit}
                    onChangeText={(text) => updateIngredient(row.key, { unit: text })}
                    placeholder="cup"
                    style={[styles.input, styles.unitInput]}
                  />
                  <TextInput
                    value={row.name}
                    onChangeText={(text) => updateIngredient(row.key, { name: text })}
                    placeholder="ingredient name"
                    style={[styles.input, styles.nameInput]}
                  />
                  <PressableScale onPress={() => removeIngredient(row.key)} style={styles.removeButton} scaleTo={0.9}>
                    <Text style={styles.removeButtonText}>×</Text>
                  </PressableScale>
                </View>
                <TextInput
                  value={row.notes ?? ''}
                  onChangeText={(text) => updateIngredient(row.key, { notes: text })}
                  placeholder="notes (optional)"
                  style={[styles.input, styles.notesInput]}
                />
              </View>
            ))}
            <PressableScale onPress={addIngredient} style={styles.addRowButton}>
              <Text style={styles.addRowButtonText}>+ Add ingredient</Text>
            </PressableScale>
          </View>

          <Text style={styles.sectionKicker}>Steps</Text>
          <View style={styles.sectionCard}>
            {steps.map((row, index) => (
              <View key={row.key} style={styles.stepRow}>
                <Text style={styles.stepIndex}>{index + 1}</Text>
                <TextInput
                  value={row.text}
                  onChangeText={(text) => updateStep(row.key, text)}
                  placeholder="Describe this step"
                  multiline
                  style={[styles.input, styles.stepInput]}
                />
                <PressableScale onPress={() => removeStep(row.key)} style={styles.removeButton} scaleTo={0.9}>
                  <Text style={styles.removeButtonText}>×</Text>
                </PressableScale>
              </View>
            ))}
            <PressableScale onPress={addStep} style={styles.addRowButton}>
              <Text style={styles.addRowButtonText}>+ Add step</Text>
            </PressableScale>
          </View>

          <Text style={styles.sectionKicker}>What changed? (optional)</Text>
          <TextInput
            value={changeNote}
            onChangeText={setChangeNote}
            placeholder="e.g. Cut the sugar in half"
            style={styles.input}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  flex: {
    flex: 1,
  },
  header: {
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 56,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    textAlign: 'center',
    color: colors.foreground,
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
  },
  closeButtonAnchor: {
    position: 'absolute',
    left: spacing.screenPadding,
    top: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  closeButtonText: {
    color: colors.foreground,
    fontSize: 17,
    fontFamily: fontFamily.bold,
  },
  saveButtonAnchor: {
    position: 'absolute',
    right: spacing.screenPadding,
    top: 8,
  },
  saveButton: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: spacing.radiusPill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 14,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 60,
    gap: 10,
  },
  hint: {
    color: colors.subtext,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 4,
  },
  sectionKicker: {
    color: colors.subtext,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fontFamily.bold,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: spacing.radiusCard,
    padding: 14,
    gap: 10,
    ...elevation.card,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
  },
  ingredientRow: {
    gap: 8,
  },
  ingredientFieldsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  quantityInput: {
    width: 56,
  },
  unitInput: {
    width: 64,
  },
  nameInput: {
    flex: 1,
  },
  notesInput: {},
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: colors.subtext,
    fontSize: 17,
    fontFamily: fontFamily.bold,
    marginTop: -2,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  stepIndex: {
    color: colors.subtext,
    fontFamily: fontFamily.bold,
    fontSize: 14,
    width: 18,
    marginTop: 10,
  },
  stepInput: {
    flex: 1,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  addRowButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addRowButtonText: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
  },
});
