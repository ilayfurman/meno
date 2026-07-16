import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PressableScale } from './PressableScale';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';

interface ProfileSubpageHeaderProps {
  title: string;
}

export function ProfileSubpageHeader({ title }: ProfileSubpageHeaderProps) {
  const navigation = useNavigation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {/* The position:'absolute' has to live on a plain View that is the
          direct child of `wrap` — PressableScale forwards its style prop to
          an inner Animated.View, one level further in, so absolute/top/right
          set there is positioned relative to that collapsed inner box
          instead of `wrap`, which is what made the button drift down onto
          the row below it. */}
      <View style={styles.closeButtonAnchor}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.closeButton} scaleTo={0.9}>
          <Text style={styles.closeButtonText}>✕</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Title is centered on the row and the close button floats on top via
  // absolute positioning, so the title stays visually centered regardless of
  // the button's width — the same look as Rocket Money's sheet headers.
  wrap: {
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 56,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    textAlign: 'center',
    color: colors.foreground,
    fontSize: 20,
    fontFamily: fontFamily.extraBold,
  },
  closeButtonAnchor: {
    position: 'absolute',
    right: spacing.screenPadding,
    top: 12,
  },
  // A round, filled tap target reads as an obvious "close" affordance and is
  // much easier to hit than the old top-left text link — same idea as the
  // circular buttons Rocket Money uses for dismiss/close actions. White +
  // a soft shadow so it actually reads as a button against the canvas
  // background, instead of disappearing into it.
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
});
