import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProfileSubpageHeader } from '../../components/ProfileSubpageHeader';
import { PressableScale } from '../../components/PressableScale';
import { getPreferencesViaBackend } from '../../api/backend';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const plans = [
  {
    id: 'free',
    title: 'Free',
    price: '$0',
    features: ['Quick Generate (Meno’s built-in model)', 'Manual save & link import', 'Unlimited cookbook storage'],
  },
  {
    id: 'plus',
    title: 'Meno Plus',
    price: '$4.99/mo',
    features: ['Higher Quick Generate quota', 'Priority import processing', 'Early access to new features'],
  },
];

export function PlansScreen() {
  const [currentPlan, setCurrentPlan] = useState('free');
  const [selected, setSelected] = useState('free');
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  useEffect(() => {
    void getPreferencesViaBackend().then(({ plan }) => {
      setCurrentPlan(plan);
      setSelected(plan);
    });
  }, []);

  const handleCta = () => {
    if (selected === currentPlan) return;
    setUpgradeMessage("Upgrades aren't available yet — coming soon.");
  };

  return (
    <View style={styles.screen}>
      <ProfileSubpageHeader title="Plans" />
      <ScrollView contentContainerStyle={styles.content}>
        {plans.map((plan) => {
          const isSelected = plan.id === selected;
          const isCurrent = plan.id === currentPlan;
          return (
            <PressableScale key={plan.id} onPress={() => setSelected(plan.id)} style={[styles.card, isSelected && styles.cardSelected]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{plan.title}</Text>
                {isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current plan</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardPrice}>{plan.price}</Text>
              {plan.features.map((feature) => (
                <Text key={feature} style={styles.feature}>
                  · {feature}
                </Text>
              ))}
            </PressableScale>
          );
        })}

        <PressableScale onPress={handleCta} style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>{selected === currentPlan ? 'Current plan' : `Switch to ${selected}`}</Text>
        </PressableScale>
        {upgradeMessage ? <Text style={styles.upgradeMessage}>{upgradeMessage}</Text> : null}
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
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: spacing.radiusCard,
    padding: 16,
    gap: 4,
  },
  cardSelected: {
    borderColor: colors.accent2,
    backgroundColor: colors.matBackground,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: '800',
  },
  currentBadge: {
    borderRadius: spacing.radiusPill,
    backgroundColor: colors.accent2,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardPrice: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  feature: {
    color: colors.subtext,
    fontSize: 13,
  },
  ctaButton: {
    marginTop: 8,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusPill,
    paddingVertical: 14,
  },
  ctaButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  upgradeMessage: {
    color: colors.subtext,
    fontSize: 12.5,
    textAlign: 'center',
  },
});
