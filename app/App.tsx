import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";
import { ChildScreen } from "./src/child/ChildScreen";
import { LoginScreen } from "./src/parent/LoginScreen";
import { ChildListScreen } from "./src/parent/ChildListScreen";
import { CreateChildScreen } from "./src/parent/CreateChildScreen";
import { DashboardScreen } from "./src/parent/DashboardScreen";
import { ConsentScreen } from "./src/parent/ConsentScreen";
import { authStore } from "./src/shared/authStore";
import { colors } from "./src/shared/theme";

/**
 * A minimal hand-rolled navigator (no react-navigation yet — see
 * docs/PLAN.md Phase 4 note) since the screen set is still small. Screens:
 *   login -> childList -> {createChild, dashboard, consent, play}
 */
type Screen =
  | { name: "login" }
  | { name: "childList" }
  | { name: "createChild" }
  | { name: "dashboard"; childId: string }
  | { name: "consent"; childId: string }
  | { name: "play"; childId: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "login" });

  useEffect(() => {
    if (authStore.getToken()) setScreen({ name: "childList" });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {screen.name === "login" && <LoginScreen onAuthenticated={() => setScreen({ name: "childList" })} />}

      {screen.name === "childList" && (
        <ChildListScreen
          onAddChild={() => setScreen({ name: "createChild" })}
          onOpenDashboard={(childId) => setScreen({ name: "dashboard", childId })}
          onPlay={(childId) => setScreen({ name: "play", childId })}
          onLogout={() => setScreen({ name: "login" })}
        />
      )}

      {screen.name === "createChild" && (
        <CreateChildScreen onCreated={() => setScreen({ name: "childList" })} onCancel={() => setScreen({ name: "childList" })} />
      )}

      {screen.name === "dashboard" && (
        <DashboardScreen
          childId={screen.childId}
          onBack={() => setScreen({ name: "childList" })}
          onOpenConsent={() => setScreen({ name: "consent", childId: screen.childId })}
        />
      )}

      {screen.name === "consent" && (
        <ConsentScreen childId={screen.childId} onBack={() => setScreen({ name: "dashboard", childId: screen.childId })} />
      )}

      {screen.name === "play" && (
        <ChildScreen childId={screen.childId} onExit={() => setScreen({ name: "childList" })} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
