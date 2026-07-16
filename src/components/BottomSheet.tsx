import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
}

export function BottomSheet({ visible, onDismiss, children, maxHeightPercent = 80 }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(Dimensions.get('window').height);
      opacity.setValue(0);
    }
  }, [visible, translateY, opacity]);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.scrim, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { maxHeight: `${maxHeightPercent}%`, transform: [{ translateY }] }]}
      >
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,26,23,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: spacing.radiusSheet,
    borderTopRightRadius: spacing.radiusSheet,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 24,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.screenPadding + 24,
  },
});
