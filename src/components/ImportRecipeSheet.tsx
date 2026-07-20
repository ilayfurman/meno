import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { BottomSheet } from './BottomSheet';
import { PressableScale } from './PressableScale';
import {
  createRecipeViaBackend,
  importRecipeFromImageViaBackend,
  importRecipeFromPdfViaBackend,
  importRecipeFromTextViaBackend,
  importRecipeFromUrlViaBackend,
  type CreateRecipePayload,
  type DuplicateCandidate,
} from '../api/backend';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamily } from '../theme/fonts';
import type { StoredRecipe } from '../types';

type ImportSegment = 'link' | 'photo' | 'pdf' | 'text';
type ImportStatus = 'idle' | 'processing' | 'duplicate' | 'done';

interface ImportRecipeSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onImported: (recipe: StoredRecipe) => void;
  onViewExisting: (recipeId: string) => void;
}

export function ImportRecipeSheet({ visible, onDismiss, onImported, onViewExisting }: ImportRecipeSheetProps) {
  const [segment, setSegment] = useState<ImportSegment>('link');
  const [linkValue, setLinkValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string } | null>(null);
  // previewUri is just for showing the thumbnail; dataUrl (base64) is what
  // actually gets sent to the backend -- same split the recipe/profile photo
  // pickers use elsewhere.
  const [photo, setPhoto] = useState<{ previewUri: string; dataUrl: string } | null>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importedRecipe, setImportedRecipe] = useState<StoredRecipe | null>(null);
  // Populated when the backend flags a likely duplicate already in the
  // user's cookbook -- `candidate` is the already-extracted recipe, kept
  // around so "Add anyway" can go straight to createRecipeViaBackend
  // without paying for AI extraction a second time.
  const [duplicateMatch, setDuplicateMatch] = useState<{ existing: DuplicateCandidate; candidate: CreateRecipePayload } | null>(
    null,
  );
  // Tracks whether the current importedRecipe has already been handed to
  // onImported, so it's reported exactly once -- as soon as the import
  // succeeds (so it's already in the Cookbook list behind this sheet, not
  // just after the sheet closes), and NOT again on dismiss.
  const reportedRef = useRef(false);

  const reset = () => {
    setSegment('link');
    setLinkValue('');
    setTextValue('');
    setPdfFile(null);
    setPhoto(null);
    setStatus('idle');
    setError(null);
    setImportedRecipe(null);
    setDuplicateMatch(null);
    reportedRef.current = false;
  };

  // Covers dismissing any way other than a successful submit already having
  // reported it -- tapping the scrim or the hardware back button on Android.
  const handleDismiss = () => {
    if (importedRecipe && !reportedRef.current) {
      onImported(importedRecipe);
    }
    onDismiss();
    reset();
  };

  const handlePickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (!result.canceled && result.assets?.[0]) {
      setPdfFile({ uri: result.assets[0].uri, name: result.assets[0].name });
    }
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Enable photo library access in Settings to add a screenshot.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) return;

    setPhoto({ previewUri: asset.uri, dataUrl: `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` });
    setError(null);
  };

  const handleSubmit = async () => {
    if (segment === 'link' && !linkValue.trim()) {
      return;
    }
    if (segment === 'photo' && !photo) {
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
      const outcome =
        segment === 'link'
          ? await importRecipeFromUrlViaBackend(linkValue.trim())
          : segment === 'photo' && photo
            ? await importRecipeFromImageViaBackend(photo.dataUrl)
            : segment === 'pdf' && pdfFile
              ? await importRecipeFromPdfViaBackend(pdfFile)
              : await importRecipeFromTextViaBackend(textValue.trim());

      if (outcome.kind === 'duplicate') {
        setDuplicateMatch({ existing: outcome.existing, candidate: outcome.candidate });
        setStatus('duplicate');
        return;
      }

      reportImported(outcome.recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setStatus('idle');
    }
  };

  // Shared by the normal success path and "Add anyway" -- reports the
  // recipe immediately (so it's visible in the Cookbook list behind this
  // sheet right away) and flips to the confirmation screen.
  const reportImported = (recipe: StoredRecipe) => {
    setImportedRecipe(recipe);
    setStatus('done');
    onImported(recipe);
    reportedRef.current = true;
  };

  const handleAddAnyway = async () => {
    if (!duplicateMatch) return;
    setStatus('processing');
    setError(null);
    try {
      const recipe = await createRecipeViaBackend(duplicateMatch.candidate);
      reportImported(recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setStatus('idle');
    }
  };

  const handleViewExisting = () => {
    if (!duplicateMatch) return;
    onViewExisting(duplicateMatch.existing.id);
    handleDismiss();
  };

  // Done is just the happy-path close button -- the import was already
  // reported to onImported as soon as it succeeded, above.
  const handleDone = handleDismiss;

  return (
    <BottomSheet visible={visible} onDismiss={handleDismiss}>
      {status === 'processing' ? (
        <View style={styles.processing}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.processingText}>Formatting your recipe… we're structuring ingredients, steps, and tags</Text>
        </View>
      ) : status === 'duplicate' && duplicateMatch ? (
        <View style={styles.processing}>
          <View style={styles.duplicateBadge}>
            <Text style={styles.duplicateBadgeText}>👀</Text>
          </View>
          <Text style={styles.successText}>You may already have this</Text>
          <Text style={styles.duplicateSubtitle}>
            "{duplicateMatch.existing.title}" is already in your cookbook — {duplicateMatch.existing.total_time_minutes} min ·{' '}
            {duplicateMatch.existing.cuisine}
          </Text>
          <PressableScale onPress={handleViewExisting} style={styles.doneButton}>
            <Text style={styles.primaryButtonText}>View existing</Text>
          </PressableScale>
          <PressableScale onPress={handleAddAnyway} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>Add anyway</Text>
          </PressableScale>
          <PressableScale onPress={() => setStatus('idle')} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>Cancel</Text>
          </PressableScale>
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
          <Text style={styles.subtitle}>We format it for your cookbook</Text>

          <View style={styles.segmentTrack}>
            {(['link', 'photo', 'pdf', 'text'] as const).map((option) => {
              const active = option === segment;
              return (
                // Wrapping each option in a plain flex:1 View (instead of putting
                // flex:1 on PressableScale's own style) keeps the segments
                // evenly sized — PressableScale forwards `style` to its inner
                // Animated.View, which isn't the row's real flex child, so flex
                // values placed there don't distribute space correctly.
                <View key={option} style={styles.segmentItem}>
                  <PressableScale
                    onPress={() => setSegment(option)}
                    style={[styles.segmentOption, active && styles.segmentOptionActive]}
                  >
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
                      {option === 'link' ? 'Link' : option === 'photo' ? 'Photo' : option === 'pdf' ? 'PDF' : 'Text'}
                    </Text>
                  </PressableScale>
                </View>
              );
            })}
          </View>

          {segment === 'link' ? (
            <>
              <TextInput
                value={linkValue}
                onChangeText={setLinkValue}
                placeholder="Paste a recipe link"
                autoCapitalize="none"
                style={styles.input}
              />
              <Text style={styles.helperText}>
                Some sites (Instagram, TikTok) block outside access entirely — use Photo instead and paste a
                screenshot of the caption.
              </Text>
            </>
          ) : segment === 'photo' ? (
            <PressableScale onPress={handlePickPhoto} style={photo ? styles.photoPreviewZone : styles.dropZone}>
              {photo ? (
                <Image source={{ uri: photo.previewUri }} style={styles.photoPreviewImage} resizeMode="cover" />
              ) : (
                <Text style={styles.dropZoneText}>+ Choose a screenshot</Text>
              )}
            </PressableScale>
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
              scrollEnabled
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
  // Fixed height (not minHeight) -- a multiline TextInput with only
  // minHeight set has no upper bound, so it grows to fit however much text
  // is pasted in instead of staying put and scrolling internally. That's
  // what was pushing the rest of the sheet (and the keyboard) off-screen
  // with a long paste.
  textarea: {
    height: 120,
    maxHeight: 120,
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
  photoPreviewZone: {
    borderRadius: spacing.radiusCard,
    overflow: 'hidden',
    height: 160,
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  helperText: {
    color: colors.subtext,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 8,
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
  duplicateBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateBadgeText: {
    fontSize: 22,
  },
  duplicateSubtitle: {
    color: colors.subtext,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
  },
});
