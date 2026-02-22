import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({ title, onPress, loading, disabled }: PrimaryButtonProps) {
  const blocked = loading || disabled;

  return (
    <Pressable onPress={onPress} disabled={blocked} style={[styles.button, blocked && styles.blocked]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.label}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  blocked: {
    opacity: 0.65,
  },
  label: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 48 / 2.2,
  },
});
