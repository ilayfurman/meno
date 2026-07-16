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
          <PressableScale onPress={handleDone} style={styles.primaryButton}>
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
                <PressableScale
                  key={option}
                  onPress={() => setSegment(option)}
                  style={[styles.segmentOption, active && styles.segmentOptionActive]}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                    {option === 'link' ? 'Link' : option === 'pdf' ? 'PDF' : 'Text'}
                  </Text>
                </PressableScale>
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
            <PressableScale onPress={handleSubmit} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Import with Claude</Text>
            </PressableScale>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.foreground,
    fontSize: 15,
    fontFamily: fontFamily.extraBold,
  },
  subtitle: {
    color: colors.subtext,
    fontSize: 12,
    marginTop: 2,
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    marginBottom: 16,
    backgroundColor: '#f3f0ea',
    borderRadius: 12,
    padding: 4,
  },
  segmentOption: {
    flex: 1,
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
    backgroundColor: colors.matBackground,
    borderWidth: 1,
    borderColor: colors.hairline,
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
    backgroundColor: colors.matBackground,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#ddd4c2',
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
    gap: 10,
    marginTop: 20,
  },
  ghostButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  ghostButtonText: {
    color: colors.subtext,
    fontFamily: fontFamily.bold,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
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
