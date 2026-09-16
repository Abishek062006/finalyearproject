/**
 * The companion guide character (README §8). Introduces activities,
 * encourages, celebrates — never makes medical or psychological claims.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../shared/theme";
import { ThemeCode, THEME_ASSETS } from "../shared/theme";

export function GuideBubble({ theme, text }: { theme: ThemeCode; text: string }) {
  const asset = THEME_ASSETS[theme];
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: asset.accent }]}>
        <Text style={styles.avatarEmoji}>{asset.emoji}</Text>
      </View>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  avatarEmoji: { fontSize: 36 },
  bubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: colors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bubbleText: { fontSize: typography.guide, color: colors.textPrimary, fontWeight: "600" },
});
