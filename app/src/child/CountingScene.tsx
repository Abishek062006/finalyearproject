/**
 * Renders the themed counting scene for a Numbers 1-5 item
 * (README §7: "Instead of '3 + 2 = ?' use [N real photos] — how many?").
 */
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, THEME_ASSETS, ThemeCode, typography, childFonts } from "../shared/theme";

export function CountingScene({ theme, count, promptText }: { theme: ThemeCode; count: number; promptText?: string }) {
  const asset = THEME_ASSETS[theme];
  return (
    <View style={styles.card}>
      <View style={styles.photoRow}>
        {Array.from({ length: count }).map((_, i) => (
          <Image key={i} source={asset.image} style={styles.photo} />
        ))}
      </View>
      <Text style={styles.prompt}>{promptText || `How many ${asset.guideName.toLowerCase()} friends?`}</Text>
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
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  photoRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xs, marginBottom: spacing.md },
  photo: { width: 56, height: 56, borderRadius: 14 },
  prompt: { fontSize: typography.prompt * 0.55, color: colors.textPrimary, fontFamily: childFonts.bold },
});
