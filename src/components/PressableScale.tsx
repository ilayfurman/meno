import React, { useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

interface PressableScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children: React.ReactNode;
}

export function PressableScale({
  onPress,
  onLongPress,
  scaleTo = 0.95,
  style,
  disabled,
  children,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animateTo(scaleTo)}
      onPressOut={() => animateTo(1)}
      disabled={disabled}
    >
      <Animated.View style={[style, disabled && { opacity: 0.6 }, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
