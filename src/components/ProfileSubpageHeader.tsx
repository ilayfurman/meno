import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PressableScale } from './PressableScale';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamily } from '../theme/fonts';

interface ProfileSubpageHeaderProps {
  title: string;
}

export function ProfileSubpageHeader({ title }: ProfileSubpageHeaderProps) {
  const navigation = useNavigation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <PressableScale onPress={() => navigation.goBack()} style={styles.closeButton} scaleTo={0.9}>
        <Text style={styles.closeButtonText}>✕</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    flex: 1,
    color: colors.foreground,
    fontSize: 22,
    fontFamily: fontFamily.extraBold,
  },
  // A round, filled tap target reads as an obvious "close" affordance and is
  // much easier to hit than the old top-left text link — same idea as the
  // circular buttons Rocket Money uses for dismiss/close actions.
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.foreground,
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
});
