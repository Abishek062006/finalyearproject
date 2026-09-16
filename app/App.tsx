import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";
import { ChildScreen } from "./src/child/ChildScreen";
import { colors } from "./src/shared/theme";

/**
 * Entry point for the Phase 2 vertical slice. Parent and educator
 * dashboards get their own entry/navigation once auth lands
 * (docs/PLAN.md Phase 3) — for now this always boots the child screen.
 */
export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ChildScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
