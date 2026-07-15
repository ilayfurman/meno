import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { BottomSheet } from './BottomSheet';
import { PressableScale } from './PressableScale';
import { buildRecipeHtml, buildRecipePlainText } from '../utils/recipeExport';
import { colors } from '../theme/colors';
import type { StoredRecipe } from '../types';

interface ShareRecipeSheetProps {
  visible: boolean;
  onDismiss: () => void;
  recipe: StoredRecipe;
}

export function ShareRecipeSheet({ visible, onDismiss, recipe }: ShareRecipeSheetProps) {
  const [copied, setCopied] = useState(false);

  const handleShareLink = async () => {
    const link = `meno://recipe/${recipe.id}`;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Share.share({ message: link });
    } else {
      await Clipboard.setStringAsync(link);
    }
  };

  const handleSharePdf = async () => {
    const html = buildRecipeHtml(recipe);
    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri);
    }
  };

  const handleCopyText = async () => {
    await Clipboard.setStringAsync(buildRecipePlainText(recipe));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <Text style={styles.title}>Share {recipe.title}</Text>

      <PressableScale onPress={handleShareLink} style={styles.row}>
        <Text style={styles.rowIcon}>🔗</Text>
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowLabel}>Share as a Meno link</Text>
          <Text style={styles.rowDescription}>
            Opens read-only in the Meno app or web — best for recipients who use Meno.
          </Text>
        </View>
      </PressableScale>

      <PressableScale onPress={handleSharePdf} style={styles.row}>
        <Text style={styles.rowIcon}>📄</Text>
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowLabel}>Share as PDF</Text>
          <Text style={styles.rowDescription}>
            A clean printable copy — best for texting, printing, or non-Meno users.
          </Text>
        </View>
      </PressableScale>

      <PressableScale onPress={handleCopyText} style={styles.row}>
        <Text style={styles.rowIcon}>💬</Text>
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowLabel}>{copied ? 'Copied ✓' : 'Copy as text'}</Text>
          <Text style={styles.rowDescription}>Plain ingredients + steps — fastest for a quick message.</Text>
        </View>
      </PressableScale>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  rowIcon: {
    fontSize: 20,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  rowDescription: {
    color: colors.subtext,
    fontSize: 12.5,
    marginTop: 2,
  },
});
