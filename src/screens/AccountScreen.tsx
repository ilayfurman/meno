import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAppContext } from '../navigation/AppContext';
import { PrimaryButton } from '../components/PrimaryButton';

export function AccountScreen() {
  const { userProfile, setUserProfile } = useAppContext();
  const [name, setName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setUserProfile({ name: name.trim(), email: email.trim() });
    Alert.alert('Saved', 'Account details updated.');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.section}>
        <Text style={styles.label}>Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} autoCapitalize="words" />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
      </View>

      <Pressable onPress={() => Alert.alert('Change password', 'Password flow will be connected in auth backend step.')}>
        <Text style={styles.link}>Change password</Text>
      </Pressable>

      <PrimaryButton title="Save changes" onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textPrimary,
  },
  link: {
    color: colors.primaryAccent,
    fontSize: 15,
    fontWeight: '600',
  },
});
