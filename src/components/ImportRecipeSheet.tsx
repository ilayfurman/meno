import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { BottomSheet } from './BottomSheet';
import { PressableScale } from './PressableScale';
import { importRecipeFromPdfViaBackend, importRecipeFromTextViaBackend, importRecipeFromUrlViaBackend } from '../api/backend';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamily } from '../theme/fonts';
import type { StoredRecipe } from '../types';

type ImportSegment = 'link' | 'pdf' | 'text';
type ImportStatus = 'idle' | 'processing' | 'done';

interface ImportRecipeSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onImported: (recipe: StoredRecipe) => void;
}

export function ImportRecipeSheet({ visible, onDismiss, onImported }: ImportRecipeSheetProps) {
  const [segment, setSegment] = useState<ImportSegment>('link');
  const [linkValue, setLinkValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string } | null>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importedRecipe, setImportedRecipe] = useState<StoredRecipe | null>(null);

  const reset = () => {
    setSegment('link');
    setLinkValue('');
    setTextValue('');
    setPdfFile(null);
    setStatus('idle');
    setError(null);
    setImportedRecipe(null);
  };

  const handleDismiss = () => {
    onDismiss();
    reset();
  };

  const handlePickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (!result.canceled && result.assets?.[0]) {
      setPdfFile({ uri: result.assets[0].uri, name: result.assets[0].name });
    }
  };

  const handleSubmit = async () => {
    if (segment === 'link' && !linkValue.trim()) {
      return;
    }
    if (segment === 'pdf' && !pdfFile) {
      return;
    }
    if (segment === 'text' && !textValue.trim()) {
      return;
    }

    setStatus('processing');
    setError(null);
    try {
      const recipe =
        segment === 'link'
          ? await importRecipeFromUrlViaBackend(linkValue.trim())
          : segment === 'pdf' && pdfFile
            ? await importRecipeFromPdfViaBackend(pdfFile)
            : await importRecipeFromTextViaBackend(textValue.trim());
      setImportedRecipe(recipe);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setStatus('idle');
    }
  };

  const handleDone = () => {
    if (importedRecipe) {
      onImported(importedRecipe);
    }
    handleDismiss();
  };

  return (
    <BottomSheet visible={visible} onDismiss={handleDismiss}>
      {status === 'processing' ? (
        <View style={styles.processing}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.processingText}>Formatting your recipe… Claude is structuring ingredients, steps, and tags</Text>
        </View>
      ) : status === 'done' && importedRecipe ? (
        <View style={styles.processing}>
          <Text style={styles.successText}>Saved to your Cookbook — {importedRecipe.title} is ready</Text>
          <PressableScale onPress={handleDone} style={styles.doneButton}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Add a recipe</Text>
          <Text style={styles.subtitle}>Claude formats it for your cookbook</Text>

          <View style={styles.segmentTrack}>
            {(['link', 'pdf', 'text'] as const).map((option) => {
              const active = option === segment;
              return (
                // Wrapping each option in a plain flex:1 View (instead of putting
                // flex:1 on PressableScale's own style) keeps the three segments
                // evenly sized — PressableScale forwards `style` to its inner
                // Animated.View, which isn't the row's real flex child, so flex
                // values placed there don't distribute space correctly.
                <View key={option} style={styles.segmentItem}>
                  <PressableScale
                    onPress={() => setSegment(option)}
                    style={[styles.segmentOption, active && styles.segmentOptionActive]}
                  >
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                      {option === 'link' ? 'Link' : option === 'pdf' ? 'PDF' : 'Text'}
                    </Text>
                  </PressableScale>
                </View>
              );
            })}
          </View>

          {segment === 'link' ? (
            <TextInput
              value={linkValue}
              onChangeText={setLinkValue}
              placeholder="Paste a recipe link"
              autoCapitalize="none"
              style={styles.input}
            />
          ) : segment === 'pdf' ? (
            <PressableScale onPress={handlePickPdf} style={styles.dropZone}>
              <Text style={styles.dropZoneText}>{pdfFile?.name ?? '+ Choose a PDF'}</Text>
            </PressableScale>
          ) : (
            <TextInput
              value={textValue}
              onChangeText={setTextValue}
              placeholder="Paste recipe text — from WhatsApp, Notes, anywhere"
              multiline
              style={[styles.input, styles.textarea]}
            />
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actionRow}>
            <PressableScale onPress={handleDismiss} style={styles.ghostButton}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </PressableScale>
            <View style={styles.primaryButtonWrap}>
              <PressableScale onPress={handleSubmit} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText} numberOfLines={1}>
                  Add recipe
                </Text>
              </PressableScale>
            </View>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    color: colors.foreground,
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.subtext,
    fontSize: 12.5,
    marginTop: 4,
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
    marginBottom: 16,
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
  },
  segmentOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 9,
  },
  segmentOptionActive: {
    backgroundColor: '#fff',
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  segmentLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    color: colors.subtext,
  },
  segmentLabelActive: {
    color: colors.foreground,
  },
  input: {
    backgroundColor: colors.canvas,
    borderWidth: 0,
    borderRadius: spacing.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  dropZone: {
    backgroundColor: colors.canvas,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d3d3d9',
    borderRadius: spacing.radiusCard,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  dropZoneText: {
    color: colors.subtext,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  // Cancel stays a plain text link sized to its own content — it doesn't need
  // (and shouldn't take) equal billing with the primary action.
  ghostButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 14,
  },
  ghostButtonText: {
    color: colors.subtext,
    fontFamily: fontFamily.bold,
    fontSize: 14,
  },
  // The flex:1 lives on this wrapper, not on primaryButton itself — see the
  // segmentItem comment above for why (PressableScale forwards style to an
  // inner Animated.View, which isn't the row's real flex participant).
  primaryButtonWrap: {
    flex: 1,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 14.5,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  processing: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  processingText: {
    color: colors.subtext,
    textAlign: 'center',
    fontSize: 14,
  },
  successText: {
    color: colors.foreground,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: fontFamily.semiBold,
  },
});
