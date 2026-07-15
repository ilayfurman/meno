import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingDietScreen } from '../screens/OnboardingDietScreen';
import { OnboardingAllergiesScreen } from '../screens/OnboardingAllergiesScreen';
import { OnboardingPrefsScreen } from '../screens/OnboardingPrefsScreen';
import { MainTabsScreen } from '../screens/MainTabsScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { QuickGenerateScreen } from '../screens/QuickGenerateScreen';
import { DietaryPreferencesScreen } from '../screens/profile/DietaryPreferencesScreen';
import { NotificationsScreen } from '../screens/profile/NotificationsScreen';
import { HelpCenterScreen } from '../screens/profile/HelpCenterScreen';
import { ContactUsScreen } from '../screens/profile/ContactUsScreen';
import { RateMenoScreen } from '../screens/profile/RateMenoScreen';
import { TermsScreen } from '../screens/profile/TermsScreen';
import { PrivacyScreen } from '../screens/profile/PrivacyScreen';
import { PlansScreen } from '../screens/profile/PlansScreen';
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
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="QuickGenerate" component={QuickGenerateScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="ProfileDietary" component={DietaryPreferencesScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="ProfileNotifications" component={NotificationsScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="ProfileHelpCenter" component={HelpCenterScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="ProfileContactUs" component={ContactUsScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="ProfileRateMeno" component={RateMenoScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="ProfileTerms" component={TermsScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="ProfilePrivacy" component={PrivacyScreen} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="ProfilePlans" component={PlansScreen} options={{ headerShown: false, presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
