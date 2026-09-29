import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, SegmentedControl, spacing, Text, TextField, useTheme } from "../design";
import { api } from "../shared/api";
import { authStore } from "../shared/authStore";
import { useAuth } from "../shared/AuthProvider";

type Mode = "login" | "register";
type Role = "parent" | "educator";

export function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = email.trim() && password && (mode === "login" || displayName.trim());

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res =
        mode === "login"
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), password, displayName.trim(), role);
      authStore.setToken(res.access_token);
      await refresh(); // the navigator switches to the right space on its own
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.includes("401") ? "That email and password don't match." : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.column}>
          <View style={[styles.mark, { backgroundColor: colors.tint }]}>
            <Text variant="title1" tone="onTint">
              A
            </Text>
          </View>
          <Text variant="largeTitle" align="center">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </Text>
          <Text variant="body" tone="secondary" align="center" style={styles.tagline}>
            Same learning goals. Different learning journeys.
          </Text>

          <Animated.View layout={LinearTransition.springify().damping(24)}>
            {mode === "register" && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
                <View style={{ marginBottom: spacing.md }}>
                  <SegmentedControl<Role>
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: "parent", label: "Parent or guardian" },
                      { value: "educator", label: "Teacher or therapist" },
                    ]}
                  />
                </View>
                <TextField
                  label="Your name"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Ada Lovelace"
                  autoCapitalize="words"
                  textContentType="name"
                  autoComplete="name"
                />
              </Animated.View>
            )}

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={mode === "login" ? "password" : "newPassword"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onSubmitEditing={() => canSubmit && submit()}
              returnKeyType="go"
            />

            {!!error && (
              <Text variant="footnote" tone="destructive" style={{ marginBottom: spacing.sm }}>
                {error}
              </Text>
            )}

            <Button title={mode === "login" ? "Sign in" : "Create account"} onPress={submit} loading={loading} disabled={!canSubmit} />
            <Button
              title={mode === "login" ? "New to AURA? Create an account" : "Already have an account? Sign in"}
              variant="plain"
              size="medium"
              fullWidth
              style={{ marginTop: spacing.sm }}
              onPress={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            />
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg },
  column: { width: "100%", maxWidth: 420, alignSelf: "center" },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  tagline: { marginTop: spacing.xs, marginBottom: spacing.xl },
});
