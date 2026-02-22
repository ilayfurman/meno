import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search' }: SearchBarProps) {
  return (
    <View style={styles.shell}>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  input: {
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 18,
  },
});
