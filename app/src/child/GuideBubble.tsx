/**
 * The companion guide character (README §8). Introduces activities,
 * encourages, celebrates — never makes medical or psychological claims.
 *
 * Renders whatever image it's given — the caller decides whether that's the
 * child's own parent-chosen companion or the theme's built-in character
 * (docs/PLAN.md UX-overhaul Phase C) — this component doesn't need to know
 * which.
 */
import React from "react";
import { Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography, childFonts } from "../shared/theme";

export function GuideBubble({
  imageSource,
  accentColor,
  text,
}: {
  imageSource: ImageSourcePropType;
  accentColor: string;
  text: string;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { borderColor: accentColor }]}>
        <Image source={imageSource} style={styles.avatarImage} />
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
    borderWidth: 2,
    overflow: "hidden",
    marginRight: spacing.sm,
  },
  avatarImage: { width: "100%", height: "100%" },
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
  bubbleText: { fontSize: typography.guide, color: colors.textPrimary, fontFamily: childFonts.regular },
});
