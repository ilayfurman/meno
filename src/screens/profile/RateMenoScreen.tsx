import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProfileSubpageHeader } from '../../components/ProfileSubpageHeader';
import { PressableScale } from '../../components/PressableScale';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/fonts';

// TODO: replace YOUR_APP_ID once Meno has a real App Store listing.
const APP_STORE_REVIEW_URL = 'itms-apps://itunes.apple.com/app/idYOUR_APP_ID?action=write-review';

export function RateMenoScreen() {
  const navigation = useNavigation();
  const [thanked, setThanked] = useState(false);

  const handleRate = () => {
    void Linking.openURL(APP_STORE_REVIEW_URL);
    setThanked(true);
  };

  return (
    <View style={styles.screen}>
      <ProfileSubpageHeader title="Rate Meno" />
      <View style={styles.content}>
        <Text style={styles.stars}>★★★★★</Text>
        {thanked ? (
          <Text style={styles.thanksText}>Thanks for the support!</Text>
        ) : (
          <PressableScale onPress={handleRate} style={styles.rateButton}>
            <Text style={styles.rateButtonText}>Rate on the App Store</Text>
          </PressableScale>
        )}
        <PressableScale onPress={() => navigation.goBack()} style={styles.dismissButton}>
          <Text style={styles.dismissButtonText}>Not now</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    gap: 16,
  },
  stars: {
    fontSize: 32,
    color: colors.accent,
  },
  rateButton: {
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  rateButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
  },
  thanksText: {
    color: colors.foreground,
    fontSize: 15,
    fontFamily: fontFamily.semiBold,
  },
  dismissButton: {
    paddingVertical: 8,
  },
  dismissButtonText: {
    color: colors.subtext,
    fontFamily: fontFamily.semiBold,
  },
});
