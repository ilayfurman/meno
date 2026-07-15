import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProfileSubpageHeader } from '../../components/ProfileSubpageHeader';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function TermsScreen() {
  return (
    <View style={styles.screen}>
      <ProfileSubpageHeader title="Terms of Service" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>
          Meno&apos;s Terms of Service are pending legal review and are not yet finalized. This page will be
          updated with the complete terms before public launch.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
