import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProfileSubpageHeader } from '../../components/ProfileSubpageHeader';
import { PressableScale } from '../../components/PressableScale';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamily } from '../../theme/fonts';

const faqs = [
  { question: 'How do I save a recipe to my cookbook?', answer: 'Tap the + button on the Cookbook screen to import from a link, or save a Quick Generate result directly.' },
  { question: 'What is a recipe version?', answer: 'Every time you refine a recipe, a new version is added with its own change note. Switch between versions from Recipe Detail.' },
  { question: 'How do I import a recipe?', answer: 'Tap the + button on Cookbook and paste a link. PDF and text import are coming soon.' },
  { question: 'How do I favorite a recipe?', answer: 'Tap the heart icon on any recipe card or on Recipe Detail.' },
  { question: 'Can I connect Claude or ChatGPT?', answer: 'Coming soon — this will let you save and manage recipes directly from a chat conversation.' },
];

export function HelpCenterScreen() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return faqs;
    const q = query.trim().toLowerCase();
    return faqs.filter((item) => item.question.toLowerCase().includes(q));
  }, [query]);

  return (
    <View style={styles.screen}>
      <ProfileSubpageHeader title="Help Center" />
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search help topics"
          style={styles.search}
        />
        {filtered.map((item, index) => {
          const isOpen = expanded === index;
          return (
            <PressableScale key={item.question} onPress={() => setExpanded(isOpen ? null : index)} style={styles.faqRow}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              {isOpen ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    gap: 4,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: spacing.radiusCard,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.foreground,
    marginBottom: 12,
  },
  faqRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineAlt,
  },
  faqQuestion: {
    color: colors.foreground,
    fontSize: 14.5,
    fontFamily: fontFamily.bold,
  },
  faqAnswer: {
    color: colors.subtext,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
});
