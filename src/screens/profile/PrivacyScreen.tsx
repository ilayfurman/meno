import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProfileSubpageHeader } from '../../components/ProfileSubpageHeader';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function PrivacyScreen() {
  return (
    <View style={styles.screen}>
      <ProfileSubpageHeader title="Privacy Policy" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>
          Meno&apos;s Privacy Policy is pending legal review and is not yet finalized. This page will be updated
          with the complete policy before public launch.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
  },
  body: {
    color: colors.subtext,
    fontSize: 14,
    lineHeight: 20,
  },
});
