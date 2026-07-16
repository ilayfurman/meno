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
      <PressableScale onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹ Back to Profile</Text>
      </PressableScale>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
  },
  title: {
    color: colors.foreground,
    fontSize: 22,
    fontFamily: fontFamily.extraBold,
  },
});
