import { Nunito_600SemiBold, Nunito_800ExtraBold, useFonts } from "@expo-google-fonts/nunito";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initSounds, settingsStore } from "./src/design";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/shared/AuthProvider";
import { ErrorBoundary } from "./src/shared/ErrorBoundary";

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_600SemiBold, Nunito_800ExtraBold });

  useEffect(() => {
    settingsStore.hydrate();
    initSounds();
  }, []);

  // A font failure falls back to the system font rather than a blank app.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
