import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../shared/api";
import { authStore } from "../shared/authStore";
import { colors, spacing } from "../shared/theme";
import { Card, ErrorText, LabeledInput, PrimaryButton, ScreenTitle, SecondaryButton } from "../shared/ui";

export function LoginScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = mode === "login" ? await api.login(email, password) : await api.register(email, password, displayName);
      authStore.setToken(res.access_token);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.brand}>AURA</Text>
        <Text style={styles.tagline}>Same learning goals. Different learning journeys.</Text>

        <Card style={styles.card}>
          <ScreenTitle>{mode === "login" ? "Welcome back" : "Create an account"}</ScreenTitle>

          {mode === "register" && (
            <LabeledInput label="Your name" value={displayName} onChangeText={setDisplayName} placeholder="Ada" autoCapitalize="words" />
          )}
          <LabeledInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
          <LabeledInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />

          <ErrorText>{error}</ErrorText>

          <View style={{ height: spacing.sm }} />
          <PrimaryButton title={mode === "login" ? "Log in" : "Register"} onPress={submit} loading={loading} />
          <SecondaryButton
            title={mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
            onPress={() => setMode(mode === "login" ? "register" : "login")}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  brand: { fontSize: 40, fontWeight: "800", color: colors.primaryDark, marginBottom: spacing.xs },
  tagline: { fontSize: 15, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: "center" },
  card: { width: "100%", maxWidth: 420 },
});
