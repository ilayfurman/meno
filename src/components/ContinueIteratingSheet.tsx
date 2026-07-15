import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { BottomSheet } from './BottomSheet';
import { PressableScale } from './PressableScale';
import { buildContinueIteratingText } from '../utils/recipeExport';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { StoredRecipe } from '../types';

interface ContinueIteratingSheetProps {
  visible: boolean;
  onDismiss: () => void;
  recipe: StoredRecipe;
}

export function ContinueIteratingSheet({ visible, onDismiss, recipe }: ContinueIteratingSheetProps) {
  const [copied, setCopied] = useState(false);
  const text = buildContinueIteratingText(recipe);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <Text style={styles.title}>Continue iterating</Text>
      <Text style={styles.subtitle}>Paste this into a fresh Claude/ChatGPT chat to keep refining.</Text>
      <ScrollView style={styles.textBox} nestedScrollEnabled>
        <Text style={styles.text}>{text}</Text>
      </ScrollView>
      <PressableScale onPress={handleCopy} style={styles.copyButton}>
        <Text style={styles.copyButtonText}>{copied ? 'Copied ✓' : 'Copy'}</Text>
      </PressableScale>
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
    marginTop: 4,
    marginBottom: 14,
  },
  textBox: {
    maxHeight: 260,
    backgroundColor: colors.matBackground,
    borderRadius: spacing.radiusCard,
    padding: 14,
  },
  text: {
    color: colors.foreground,
    fontSize: 12.5,
    lineHeight: 18,
  },
  copyButton: {
    marginTop: 16,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 14,
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
