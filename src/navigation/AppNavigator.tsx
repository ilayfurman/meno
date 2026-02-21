import React from 'react';
import { Pressable, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { OnboardingDietScreen } from '../screens/OnboardingDietScreen';
import { OnboardingAllergiesScreen } from '../screens/OnboardingAllergiesScreen';
import { OnboardingPrefsScreen } from '../screens/OnboardingPrefsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { CookbookScreen } from '../screens/CookbookScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  onboardingComplete: boolean;
}

export function AppNavigator({ onboardingComplete }: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!onboardingComplete ? (
          <>
            <Stack.Screen name="OnboardingDiet" component={OnboardingDietScreen} options={{ title: 'Welcome' }} />
            <Stack.Screen name="OnboardingAllergies" component={OnboardingAllergiesScreen} options={{ title: 'Allergies' }} />
            <Stack.Screen name="OnboardingPrefs" component={OnboardingPrefsScreen} options={{ title: 'Preferences' }} />
          </>
        ) : null}

        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            title: 'Pick tonight',
            headerRight: () => (
              <Pressable onPress={() => navigation.navigate('Cookbook')}>
                <Text>Cookbook</Text>
              </Pressable>
            ),
          })}
        />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Results' }} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: 'Recipe' }} />
        <Stack.Screen name="Cookbook" component={CookbookScreen} options={{ title: 'Cookbook' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
