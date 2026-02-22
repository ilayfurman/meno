import React from 'react';
import { Chip } from './Chip';

interface OptionChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function OptionChip({ label, selected, onPress }: OptionChipProps) {
  return <Chip label={label} selected={selected} onPress={onPress} />;
}
