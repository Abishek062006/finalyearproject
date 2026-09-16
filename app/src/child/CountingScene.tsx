/**
 * Renders the themed counting scene for a Numbers 1-5 item
 * (README §7: "Instead of '3 + 2 = ?' use 🦖🦖🦖 — how many dinosaurs?").
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, THEME_ASSETS, ThemeCode, typography } from "../shared/theme";

export function CountingScene({ theme, count }: { theme: ThemeCode; count: number }) {
  const asset = THEME_ASSETS[theme];
  return (
    <View style={styles.card}>
      <Text style={styles.emojiRow}>{asset.emoji.repeat(count)}</Text>
      <Text style={styles.prompt}>How many {asset.guideName.toLowerCase()} friends?</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    shadowColor: colors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  emojiRow: { fontSize: 56, letterSpacing: 8, marginBottom: spacing.md, textAlign: "center" },
  prompt: { fontSize: typography.prompt * 0.55, color: colors.textPrimary, fontWeight: "700" },
});
