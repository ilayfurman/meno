import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'react-native';
import { colors } from '../theme/colors';

interface MattedPhotoProps {
  uri?: string | null;
  aspectRatio?: number;
  borderRadius?: number;
}

export function MattedPhoto({ uri, aspectRatio = 1, borderRadius = 18 }: MattedPhotoProps) {
  return (
    <View style={[styles.mat, { aspectRatio, borderRadius }]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { borderRadius: borderRadius - 6 }]} resizeMode="cover" />
      ) : (
        <View style={[styles.placeholder, { borderRadius: borderRadius - 6 }]}>
          <Text style={styles.placeholderText}>recipe photo</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mat: {
    backgroundColor: colors.matBackground,
    padding: 6,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.hairlineAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.subtext,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
