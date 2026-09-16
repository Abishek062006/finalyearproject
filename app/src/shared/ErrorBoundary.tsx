/**
 * Crash reporting (docs/PLAN.md Phase 9 pilot-readiness). A JS crash on a
 * school tablet, mid-pilot, with a child or a parent looking at it, must
 * never be a blank white screen — this catches it, shows something a
 * non-technical person can act on, and reports it so it can actually get
 * fixed (backend/app/api/telemetry.py — no paid crash SDK, per the
 * project's no-paid-API constraint).
 *
 * Must be a class component: React only supports error boundaries via
 * getDerivedStateFromError/componentDidCatch, there is no hook equivalent.
 */
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { API_BASE } from "./api";
import { colors, spacing } from "./theme";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    fetch(`${API_BASE}/telemetry/crash-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? null,
        message: error.message || String(error),
        stack: `${error.stack ?? ""}\n\nComponent stack:${info.componentStack ?? ""}`,
      }),
    }).catch(() => {
      // The crash reporter failing too must never throw again — there is
      // nothing further to do locally if even this request can't go out.
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected problem. It's been reported. Try again, or close and reopen the app.
        </Text>
        <Pressable style={styles.button} onPress={() => this.setState({ hasError: false })}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  title: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.sm },
  body: { fontSize: 15, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg },
  button: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 20 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
