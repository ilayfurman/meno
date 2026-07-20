import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/fonts';
import { elevation } from '../theme/elevation';

interface MattedPhotoProps {
  uri?: string | null;
  aspectRatio?: number;
  borderRadius?: number;
  // When provided, an edit button is overlaid on the photo (bottom-right)
  // so the user can attach/replace a picture. `editing` shows a spinner in
  // its place while an upload is in flight.
  onEditPress?: () => void;
  editing?: boolean;
}

export function MattedPhoto({ uri, aspectRatio = 1, borderRadius = 18, onEditPress, editing }: MattedPhotoProps) {
  return (
    // Shadow lives on the outer wrapper (overflow must stay visible for it to
    // render); the inner `mat` view keeps `overflow: hidden` so the image/
    // placeholder actually gets clipped to the rounded corners.
    <View style={[styles.shadowWrap, { aspectRatio, borderRadius }]}>
      <View style={[styles.mat, { borderRadius }]}>
        {uri ? (
          // key={uri} forces a clean remount whenever the photo changes,
          // instead of React reusing the same <Image> instance and just
          // swapping its source.uri prop. That reuse path is the known RN
          // gotcha where an on-screen Image doesn't reliably redecode a new
          // uri (especially base64 data: URIs) -- which is why a just-added
          // recipe photo wouldn't show up on the Cookbook grid until a
          // second navigation remounted the card from scratch.
          <Image
            key={uri}
            source={{ uri }}
            style={[styles.image, { borderRadius: borderRadius - 6 }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholder, { borderRadius: borderRadius - 6 }]}>
            <Text style={styles.placeholderText}>recipe photo</Text>
          </View>
        )}
      </View>
      {onEditPress ? (
        // Positioning (absolute/bottom/right) has to live on this plain
        // wrapping View, not on PressableScale itself -- PressableScale
        // forwards `style` to its inner Animated.View, not the outer
        // Pressable that actually participates in the parent's layout, so
        // layout-critical styles passed directly to it are silently dropped.
        <View style={styles.editButtonWrap}>
          <PressableScale onPress={onEditPress} style={styles.editButton} scaleTo={0.92} disabled={editing}>
            {editing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.editButtonText}>{uri ? '✎' : '+'}</Text>
            )}
          </PressableScale>
        </View>
      ) : null}
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
  editButtonWrap: {
    position: 'absolute',
    bottom: 14,
    right: 14,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(28,26,23,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: fontFamily.bold,
  },
});
