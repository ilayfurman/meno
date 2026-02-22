import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAppContext } from '../navigation/AppContext';
import type { PlanTier } from '../types';

const plans: Array<{ id: PlanTier; title: string; price: string; perks: string }> = [
  { id: 'free', title: 'Free', price: '$0', perks: '3 suggestions per request, basic personalization' },
  { id: 'plus', title: 'Plus', price: '$9.99', perks: 'Priority generation and richer personalization' },
  { id: 'pro', title: 'Pro', price: '$19.99', perks: 'Advanced controls and future premium features' },
];

export function BillingScreen() {
  const { billing, setBilling } = useAppContext();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Billing & Plan</Text>
      <View style={styles.stack}>
        {plans.map((plan) => {
          const active = billing.plan === plan.id;
          return (
            <Pressable key={plan.id} style={[styles.planCard, active && styles.planCardActive]} onPress={() => setBilling({ ...billing, plan: plan.id })}>
              <View style={styles.planRow}>
                <Text style={styles.planName}>{plan.title}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
              </View>
              <Text style={styles.planPerks}>{plan.perks}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.actionButton} onPress={() => Alert.alert('Coming soon', 'Subscription checkout will be wired in the payments integration step.')}>
        <Text style={styles.actionLabel}>Upgrade / Manage plan</Text>
      </Pressable>
      <Pressable style={styles.secondaryAction} onPress={() => Alert.alert('Coming soon', 'Restore purchases will be added with IAP integration.') }>
        <Text style={styles.secondaryLabel}>Restore purchase</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  title: {
    fontSize: 31,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stack: {
    gap: 10,
  },
  planCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 4,
  },
  planCardActive: {
    borderColor: colors.primaryAccent,
    backgroundColor: '#FFF5F3',
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  planPrice: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  planPerks: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  actionButton: {
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: colors.primaryAccent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
