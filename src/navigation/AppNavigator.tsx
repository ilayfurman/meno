import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingDietScreen } from '../screens/OnboardingDietScreen';
import { OnboardingAllergiesScreen } from '../screens/OnboardingAllergiesScreen';
import { OnboardingPrefsScreen } from '../screens/OnboardingPrefsScreen';
import { MainTabsScreen } from '../screens/MainTabsScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { FoodPreferencesScreen } from '../screens/FoodPreferencesScreen';
import { BillingScreen } from '../screens/BillingScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  onboardingComplete: boolean;
}

export function AppNavigator({ onboardingComplete }: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary },
        }}
      >
        {!onboardingComplete ? (
          <>
            <Stack.Screen name="OnboardingDiet" component={OnboardingDietScreen} options={{ title: 'Welcome' }} />
            <Stack.Screen name="OnboardingAllergies" component={OnboardingAllergiesScreen} options={{ title: 'Allergies' }} />
            <Stack.Screen name="OnboardingPrefs" component={OnboardingPrefsScreen} options={{ title: 'Preferences' }} />
          </>
        ) : null}

        <Stack.Screen name="MainTabs" component={MainTabsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ title: '3 Recipes' }} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: 'Recipe Detail' }} />
        <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
        <Stack.Screen name="FoodPreferences" component={FoodPreferencesScreen} options={{ title: 'Food Preferences' }} />
        <Stack.Screen name="Billing" component={BillingScreen} options={{ title: 'Billing & Plan' }} />
        <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Support' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
