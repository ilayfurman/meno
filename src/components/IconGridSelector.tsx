import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export interface IconGridItem {
  key: string;
  label: string;
  icon: string;
}

interface IconGridSelectorProps {
  items: IconGridItem[];
  selected: string;
  onChange: (key: string) => void;
  tone?: 'coral' | 'sage';
}

export function IconGridSelector({ items, selected, onChange, tone = 'sage' }: IconGridSelectorProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const active = selected === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[styles.card, active && (tone === 'sage' ? styles.cardActiveSage : styles.cardActiveCoral)]}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={[styles.label, active && (tone === 'sage' ? styles.labelActiveSage : styles.labelActiveCoral)]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '31.5%',
    minWidth: 96,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  cardActiveSage: {
    borderColor: colors.secondaryAccent,
    backgroundColor: '#F1F7F0',
  },
  cardActiveCoral: {
    borderColor: colors.primaryAccent,
    backgroundColor: '#FFF5F3',
  },
  icon: {
    fontSize: 26,
  },
  label: {
    fontSize: 41 / 2.3,
    color: colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
  },
  labelActiveSage: {
    color: colors.secondaryAccent,
    fontWeight: '700',
  },
  labelActiveCoral: {
    color: colors.primaryAccent,
    fontWeight: '700',
  },
});
