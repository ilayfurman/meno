import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface Action {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary';
}

export function BottomActionBar({ actions }: { actions: Action[] }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          disabled={action.disabled}
          style={[styles.button, action.tone !== 'secondary' && styles.primary, action.disabled && styles.disabled]}
        >
          <Text style={[styles.label, action.tone !== 'secondary' && styles.primaryLabel]}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F4F1EC',
  },
  primary: {
    backgroundColor: colors.primaryAccent,
    borderColor: colors.primaryAccent,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  primaryLabel: {
    color: '#fff',
  },
});
