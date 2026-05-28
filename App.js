/**
 * App.js
 * Punto de entrada principal.
 * Configura el navegador de pantallas y el proveedor de estado global.
 *
 * Flujo de navegación:
 * - Si onboardingComplete === false → Onboarding
 * - Si onboardingComplete === true  → Main
 *
 * Pantallas:
 *   Onboarding  → captura de letra
 *   Main        → pantalla principal (generar apunte)
 *   Preview     → vista previa y exportación
 *   Profile     → gestión de la fuente de letra
 */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/context/AppContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
import MainScreen       from './src/screens/MainScreen';
import PreviewScreen    from './src/screens/PreviewScreen';
import ProfileScreen    from './src/screens/ProfileScreen';
import { colors } from './src/constants/theme';

const Stack = createStackNavigator();

// ─── Navegador interno (consume contexto) ─────────────────────────────────────
function AppNavigator() {
  const { isLoading, onboardingComplete } = useApp();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.hueso }}>
        <ActivityIndicator size="large" color={colors.grafito} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={onboardingComplete ? 'Main' : 'Onboarding'}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Main"       component={MainScreen} />
        <Stack.Screen name="Preview"    component={PreviewScreen} />
        <Stack.Screen name="Profile"    component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Root con provider ─────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
