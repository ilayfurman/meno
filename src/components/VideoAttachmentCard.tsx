import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import type { VideoPlatform } from '../types';
import { fontFamily } from '../theme/fonts';

interface VideoAttachmentCardProps {
  videoUrl: string;
  videoPlatform: VideoPlatform;
  onEdit: () => void;
}

const platformStyles: Record<VideoPlatform, { background: string; iconBackground: string; iconColor: string; textColor: string; label: string }> = {
  tiktok: { background: '#000000', iconBackground: '#25F4EE', iconColor: '#000000', textColor: '#ffffff', label: 'TikTok' },
  instagram: { background: '#8a3ab9', iconBackground: '#ffffff', iconColor: '#c1552f', textColor: '#ffffff', label: 'Instagram' },
  youtube: { background: '#ffffff', iconBackground: '#ff0000', iconColor: '#ffffff', textColor: '#1c1a17', label: 'YouTube' },
  other: { background: '#fbf8f2', iconBackground: '#5c7a52', iconColor: '#ffffff', textColor: '#1c1a17', label: 'Video' },
};

export function VideoAttachmentCard({ videoUrl, videoPlatform, onEdit }: VideoAttachmentCardProps) {
  const style = platformStyles[videoPlatform];

  return (
    <PressableScale onPress={() => Linking.openURL(videoUrl)} style={[styles.card, { backgroundColor: style.background }]}>
      <View style={[styles.icon, { backgroundColor: style.iconBackground }]}>
        <Text style={{ color: style.iconColor, fontSize: 16 }}>▶</Text>
      </View>
      <Text style={[styles.label, { color: style.textColor }]}>
        {videoPlatform === 'other' ? 'Open link' : `Watch on ${style.label}`}
      </Text>
      <PressableScale onPress={onEdit} style={styles.editButton}>
        <Text style={styles.editIcon}>✎</Text>
      </PressableScale>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 14,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamily.bold,
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 13,
  },
});
