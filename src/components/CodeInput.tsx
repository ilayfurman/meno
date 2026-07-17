import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/fonts';

interface CodeInputProps {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
}

// Segmented OTP-style input: a single invisible TextInput drives real focus
// and the keyboard, rendered on top of `length` boxes that show one digit
// each. Tapping any box focuses the hidden input, same trick most native
// OTP fields use.
export function CodeInput({ value, onChangeText, length = 6, autoFocus }: CodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('').slice(0, length);
  const activeIndex = Math.min(digits.length, length - 1);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.wrap}>
      {Array.from({ length }).map((_, index) => {
        const filled = index < digits.length;
        const isActive = focused && index === activeIndex;
        return (
          <View
            key={index}
            style={[styles.box, filled && styles.boxFilled, isActive && styles.boxActive]}
          >
            <Text style={styles.digit}>{digits[index] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        maxLength={length}
        style={styles.hiddenInput}
        caretHidden
      />
    </Pressable>
  );
}

const BOX_SIZE = 46;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: 14,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxFilled: {
    backgroundColor: '#fff',
    borderColor: colors.hairline,
  },
  boxActive: {
    borderColor: colors.accent,
    backgroundColor: '#fff',
  },
  digit: {
    fontFamily: fontFamily.monoBold,
    fontSize: 19,
    color: colors.foreground,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
});
