import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatMessage } from '../types/cookbook';
import { colors } from '../theme/colors';

interface CookbookAgentOverlayProps {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  input: string;
  onInputChange: (text: string) => void;
  onSend: () => void;
  loading: boolean;
  selectedCount: number;
  onQuickPrompt: (text: string) => void;
}

const prompts = ['Which is fastest tonight?', 'Build a grocery list', 'Plan 3 dinners from these'];

export function CookbookAgentOverlay({
  visible,
  onClose,
  messages,
  input,
  onInputChange,
  onSend,
  loading,
  selectedCount,
  onQuickPrompt,
}: CookbookAgentOverlayProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom + 10, 18) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Meno Agent</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <View style={styles.contextPill}>
            <Text style={styles.contextText}>
              {selectedCount > 0 ? `Using ${selectedCount} selected recipes` : 'Using cookbook context'}
            </Text>
          </View>

          <ScrollView style={styles.chat} contentContainerStyle={styles.chatContent}>
            {messages.length === 0 ? (
              <Text style={styles.emptyText}>Ask anything about your recipes. I can compare, plan, and suggest swaps.</Text>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}
                >
                  <Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>{message.text}</Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.prompts}>
            {prompts.map((prompt) => (
              <Pressable key={prompt} style={styles.promptChip} onPress={() => onQuickPrompt(prompt)}>
                <Text style={styles.promptText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={onInputChange}
              placeholder="Ask about these recipes..."
              multiline
            />
            <Pressable style={[styles.send, loading && styles.sendDisabled]} onPress={onSend} disabled={loading}>
              <Text style={styles.sendText}>{loading ? '...' : 'Send'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    height: '78%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    color: colors.textSecondary,
    fontSize: 27,
    fontWeight: '500',
    lineHeight: 27,
  },
  contextPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  contextText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chat: {
    flex: 1,
  },
  chatContent: {
    gap: 10,
    paddingBottom: 6,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '90%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primaryAccent,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  userBubbleText: {
    color: '#fff',
  },
  prompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  promptText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 2,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 14,
  },
  send: {
    borderRadius: 10,
    backgroundColor: colors.primaryAccent,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.6,
  },
  sendText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
