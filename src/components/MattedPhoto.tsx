import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';

interface MattedPhotoProps {
  uri?: string | null;
  aspectRatio?: number;
  borderRadius?: number;
}

export function MattedPhoto({ uri, aspectRatio = 1, borderRadius = 18 }: MattedPhotoProps) {
  return (
    // Shadow lives on the outer wrapper (overflow must stay visible for it to
    // render); the inner `mat` view keeps `overflow: hidden` so the image/
    // placeholder actually gets clipped to the rounded corners.
    <View style={[styles.shadowWrap, { aspectRatio, borderRadius }]}>
      <View style={[styles.mat, { borderRadius }]}>
        {uri ? (
          <Image source={{ uri }} style={[styles.image, { borderRadius: borderRadius - 6 }]} resizeMode="cover" />
        ) : (
          <View style={[styles.placeholder, { borderRadius: borderRadius - 6 }]}>
            <Text style={styles.placeholderText}>recipe photo</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    ...elevation.card,
  },
  mat: {
    flex: 1,
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
    fontFamily: fontFamily.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
