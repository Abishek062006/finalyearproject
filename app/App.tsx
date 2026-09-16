import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";
import { ChildScreen } from "./src/child/ChildScreen";
import { LoginScreen } from "./src/parent/LoginScreen";
import { ChildListScreen } from "./src/parent/ChildListScreen";
import { CreateChildScreen } from "./src/parent/CreateChildScreen";
import { DashboardScreen } from "./src/parent/DashboardScreen";
import { ConsentScreen } from "./src/parent/ConsentScreen";
import { EducatorChildListScreen } from "./src/educator/EducatorChildListScreen";
import { EducatorDashboardScreen } from "./src/educator/EducatorDashboardScreen";
import { api } from "./src/shared/api";
import { authStore } from "./src/shared/authStore";
import { colors } from "./src/shared/theme";

/**
 * A minimal hand-rolled navigator (no react-navigation yet — see
 * docs/PLAN.md Phase 4 note) since the screen set is still small.
 *
 * Two role-branched flows share one shell:
 *   parent:   login -> childList -> {createChild, dashboard, consent, play}
 *   educator: login -> educatorList -> educatorProfile
 */
type Screen =
  | { name: "login" }
  | { name: "childList" }
  | { name: "createChild" }
  | { name: "dashboard"; childId: string }
  | { name: "consent"; childId: string }
  | { name: "play"; childId: string }
  | { name: "educatorList" }
  | { name: "educatorProfile"; childId: string };

function homeScreenFor(role: string): Screen {
  return role === "educator" ? { name: "educatorList" } : { name: "childList" };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "login" });
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!authStore.getToken()) return;
    api
      .me()
      .then((user) => {
        setRole(user.role);
        setScreen(homeScreenFor(user.role));
      })
      .catch(() => authStore.setToken(null)); // stale/invalid token — fall back to login
  }, []);

  function handleAuthenticated(userRole: string) {
    setRole(userRole);
    setScreen(homeScreenFor(userRole));
  }

  function logout() {
    authStore.setToken(null);
    setRole(null);
    setScreen({ name: "login" });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {screen.name === "login" && <LoginScreen onAuthenticated={handleAuthenticated} />}

      {/* ---- Parent flow ---- */}
      {screen.name === "childList" && (
        <ChildListScreen
          onAddChild={() => setScreen({ name: "createChild" })}
          onOpenDashboard={(childId) => setScreen({ name: "dashboard", childId })}
          onPlay={(childId) => setScreen({ name: "play", childId })}
          onLogout={logout}
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

      {screen.name === "play" && <ChildScreen childId={screen.childId} onExit={() => setScreen({ name: "childList" })} />}

      {/* ---- Educator flow ---- */}
      {screen.name === "educatorList" && (
        <EducatorChildListScreen onOpenProfile={(childId) => setScreen({ name: "educatorProfile", childId })} onLogout={logout} />
      )}

      {screen.name === "educatorProfile" && (
        <EducatorDashboardScreen childId={screen.childId} onBack={() => setScreen({ name: "educatorList" })} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
