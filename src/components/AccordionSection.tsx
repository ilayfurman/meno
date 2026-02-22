import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
  initiallyOpen?: boolean;
}

export function AccordionSection({ title, children, initiallyOpen = true }: AccordionSectionProps) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <View style={styles.shell}>
      <Pressable style={styles.header} onPress={() => setOpen((prev) => !prev)}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.chevron}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 29 / 1.6,
    fontWeight: '600',
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 22,
    fontWeight: '400',
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
});
