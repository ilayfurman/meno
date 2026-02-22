import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface FloatingAgentButtonProps {
  onPress: () => void;
  bottom: number;
}

export function FloatingAgentButton({ onPress, bottom }: FloatingAgentButtonProps) {
  const style: ViewStyle = {
    bottom,
  };

  return (
    <Pressable onPress={onPress} style={[styles.button, style]}>
      <Text style={styles.icon}>✨</Text>
      <Text style={styles.text}>Agent</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    borderRadius: 999,
    backgroundColor: colors.primaryAccent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  icon: {
    color: '#fff',
    fontSize: 14,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
