import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { BottomSheet } from './BottomSheet';
import { SegmentedControl } from './SegmentedControl';
import { PressableScale } from './PressableScale';
import { importRecipeFromPdfViaBackend, importRecipeFromTextViaBackend, importRecipeFromUrlViaBackend } from '../api/backend';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
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

          <View style={styles.segmentWrap}>
            <SegmentedControl
              options={['link', 'pdf', 'text'] as const}
              selected={segment}
              onChange={setSegment}
              labelFormatter={(v) => (v === 'link' ? 'Link' : v === 'pdf' ? 'PDF' : 'Text')}
              tone="coral"
            />
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
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.subtext,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 16,
  },
  segmentWrap: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: spacing.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  dropZone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairline,
    borderRadius: spacing.radiusCard,
    paddingVertical: 28,
    alignItems: 'center',
  },
  dropZoneText: {
    color: colors.subtext,
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '600',
  },
});
