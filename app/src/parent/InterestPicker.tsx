/**
 * README §5: "approximately 4-5" initial interests, not a long questionnaire.
 * We only have 4 seeded themes right now, so the cap is soft — the point is
 * the interaction pattern (a handful of taps), not the exact number.
 */
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, THEME_ASSETS, ThemeCode } from "../shared/theme";

const ALL_THEMES = Object.keys(THEME_ASSETS) as ThemeCode[];

export function InterestPicker({ selected, onChange }: { selected: string[]; onChange: (codes: string[]) => void }) {
  function toggle(code: string) {
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }

  return (
    <View style={styles.grid}>
      {ALL_THEMES.map((code) => {
        const asset = THEME_ASSETS[code];
        const isOn = selected.includes(code);
        return (
          <Pressable
            key={code}
            onPress={() => toggle(code)}
            style={[styles.chip, isOn && { backgroundColor: asset.accent, borderColor: asset.accent }]}
          >
            <Image source={asset.image} style={styles.chipPhoto} />
            <Text style={[styles.chipLabel, isOn && styles.chipLabelOn]}>{asset.guideName}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  chipPhoto: { width: 24, height: 24, borderRadius: 6, marginRight: 8 },
  chipLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  chipLabelOn: { color: "#fff" },
});
