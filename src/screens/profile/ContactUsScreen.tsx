import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProfileSubpageHeader } from '../../components/ProfileSubpageHeader';
import { PressableScale } from '../../components/PressableScale';
import { useAppContext } from '../../navigation/AppContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/fonts';

export function ContactUsScreen() {
  const { userProfile } = useAppContext();
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const subject = encodeURIComponent('Meno support request');
    const body = encodeURIComponent(message);
    void Linking.openURL(`mailto:support@meno.app?subject=${subject}&body=${body}`);
  };

  return (
    <View style={styles.screen}>
      <ProfileSubpageHeader title="Contact us" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Your email</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyText}>{userProfile.email}</Text>
          </View>

          <Text style={styles.label}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="How can we help?"
            multiline
            style={styles.textarea}
          />

          <PressableScale onPress={handleSend} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    gap: 8,
  },
  label: {
    color: colors.subtext,
    fontSize: 11,
    fontFamily: fontFamily.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  readonlyField: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: spacing.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.matBackground,
  },
  readonlyText: {
    color: colors.subtext,
    fontSize: 14,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: spacing.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.foreground,
  },
  sendButton: {
    marginTop: 16,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 14,
  },
  sendButtonText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
  },
});
