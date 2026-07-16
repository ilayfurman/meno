import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { elevation } from '../theme/elevation';

interface HeaderIcon {
  glyph: string;
  accessibilityLabel: string;
  onPress: () => void;
}

interface ScreenHeaderBandProps {
  kicker: string;
  title: string;
  leftIcon?: HeaderIcon;
  rightIcon?: HeaderIcon;
}

// A colored "hero" band behind each main tab's title — the Rocket Money-style
// touch the app was missing: a bit of brand color and depth up top instead of
// starting flat on the gray canvas. Sits above the scrollable content (not
// inside the list/ScrollView) so it stays put while the rest of the screen
// scrolls underneath its rounded bottom edge.
export function ScreenHeaderBand({ kicker, title, leftIcon, rightIcon }: ScreenHeaderBandProps) {
  const showIconRow = Boolean(leftIcon || rightIcon);
  return (
    <View style={styles.band}>
      {showIconRow ? (
        <View style={styles.iconRow}>
          <View style={styles.iconSlot}>
            {leftIcon ? (
              <PressableScale onPress={leftIcon.onPress} style={styles.iconButton} scaleTo={0.9}>
                <Text style={styles.iconGlyph}>{leftIcon.glyph}</Text>
              </PressableScale>
            ) : null}
          </View>
          <View style={styles.iconSlot}>
            {rightIcon ? (
              <PressableScale onPress={rightIcon.onPress} style={styles.iconButton} scaleTo={0.9}>
                <Text style={styles.iconGlyph}>{rightIcon.glyph}</Text>
              </PressableScale>
            ) : null}
          </View>
        </View>
      ) : null}
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.accent,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 14,
    paddingBottom: 24,
    ...elevation.raised,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconSlot: {
    width: 36,
    height: 36,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    color: '#fff',
    fontSize: 16,
  },
  kicker: {
    fontFamily: typography.sectionKicker.fontFamily,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.screenTitle.fontFamily,
    color: '#fff',
    fontSize: 26,
    letterSpacing: -0.5,
    marginTop: 4,
  },
});
