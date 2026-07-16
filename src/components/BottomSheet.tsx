import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  // KeyboardAvoidingView depends on the Modal's implicit root actually
  // handing it real flex height to grow into, which isn't reliable -- tried
  // it, the sheet never budged. Tracking the keyboard directly works, but
  // animating it via the `bottom` style prop doesn't mix with translateY's
  // native-driven transform on the same component ("Style property 'bottom'
  // is not supported by native animated module"). Native driver only
  // accelerates transform/opacity, and a component can't have one native-
  // and one JS-driven animated style at once. Fix: fold the keyboard height
  // into the SAME transform via Animated.subtract, so it's translateY the
  // whole way through -- fully native-driven, no separate 'bottom' prop.
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const combinedTranslateY = Animated.subtract(translateY, keyboardOffset);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(Dimensions.get('window').height);
      opacity.setValue(0);
      keyboardOffset.setValue(0);
    }
  }, [visible, translateY, opacity, keyboardOffset]);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.scrim, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { maxHeight: `${maxHeightPercent}%`, transform: [{ translateY: combinedTranslateY }] }]}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
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
