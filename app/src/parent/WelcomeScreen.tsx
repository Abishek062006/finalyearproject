/**
 * First thing a new grown-up sees: what AURA is, in three lines, then one
 * clear way in — the Apple "welcome / what's new" pattern.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, spacing, Text, useTheme } from "../design";

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; body: string }[] = [
  {
    icon: "sparkles",
    color: "#0A84FF",
    title: "Learns how your child learns",
    body: "Every activity adapts to what actually works for your child, and checks it's remembered days later.",
  },
  {
    icon: "leaf",
    color: "#34C759",
    title: "Calm by design",
    body: "Predictable, gentle and never punitive. Built around autistic children's needs.",
  },
  {
    icon: "lock-closed",
    color: "#5E5CE6",
    title: "You stay in control",
    body: "Private by default. You decide what's shared, and with which teachers.",
  },
];

export function WelcomeScreen({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl }]}>
        <View style={styles.column}>
          <View style={[styles.mark, { backgroundColor: colors.tint }]}>
            <Text variant="largeTitle" tone="onTint">
              A
            </Text>
          </View>
          <Text variant="largeTitle" align="center">
            Welcome to AURA
          </Text>
          <Text variant="body" tone="secondary" align="center" style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}>
            Same learning goals. Different learning journeys.
          </Text>

          {FEATURES.map((f, i) => (
            <Animated.View key={f.title} entering={FadeInDown.delay(120 + i * 90).duration(380)} style={styles.feature}>
              <Ionicons name={f.icon} size={30} color={f.color} style={styles.featureIcon} />
              <View style={{ flex: 1 }}>
                <Text variant="headline">{f.title}</Text>
                <Text variant="subhead" tone="secondary" style={{ marginTop: 2 }}>
                  {f.body}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.column}>
          <Button title="Get started" onPress={onGetStarted} />
          <Button title="I already have an account" variant="plain" size="medium" fullWidth style={{ marginTop: spacing.xs }} onPress={onSignIn} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  column: { width: "100%", maxWidth: 460, alignSelf: "center" },
  mark: { width: 76, height: 76, borderRadius: 19, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.lg },
  feature: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.lg },
  featureIcon: { width: 44, marginRight: spacing.sm, textAlign: "center" },
  bottom: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
