/**
 * Renders the themed scene for a "letter_identify" item — a single
 * decorative guide photo plus the target letter, unlike the counting basket's
 * repeated-photo counting visual (there is nothing to count here). Also
 * reused generically as the banner for whole-board activities (matching,
 * sequencing), since its job — guide photo + a fixed prompt — is the same.
 *
 * Decorative, not content-bearing (unlike the counting basket's photo, which must
 * stay theme-accurate) — so this always renders whichever image the caller
 * resolved as the "who's talking" character: the child's own companion when
 * they have one, the theme's own image otherwise (docs/PLAN.md UX-overhaul
 * Phase C).
 */
import React from "react";
import { Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography, childFonts } from "../shared/theme";

export function IdentifyScene({ imageSource, promptText }: { imageSource: ImageSourcePropType; promptText: string }) {
  return (
    <View style={styles.card}>
      <Image source={imageSource} style={styles.photo} />
      <Text style={styles.prompt}>{promptText}</Text>
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
  photo: { width: 96, height: 96, borderRadius: 24, marginBottom: spacing.md },
  prompt: { fontSize: typography.prompt * 0.55, color: colors.textPrimary, fontFamily: childFonts.bold },
});
