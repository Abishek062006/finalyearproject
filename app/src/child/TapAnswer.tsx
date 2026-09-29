/**
 * modality = "tap" (README §1 interaction types). Large touch targets,
 * shuffled choices so position never leaks the answer.
 */
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, MIN_TOUCH_TARGET, radius, spacing, typography, childFonts } from "../shared/theme";

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function TapAnswer({
  choices,
  onChoose,
  disabled,
}: {
  choices: (string | number)[];
  onChoose: (value: string | number) => void;
  disabled: boolean;
}) {
  // Depend on the VALUES, not the array reference — `choices` is a fresh
  // array on every parent render, so shuffling on [choices] would re-order
  // buttons under the child's finger on any unrelated re-render.
  const options = useMemo(() => shuffled(choices), [choices.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.row}>
      {options.map((value) => (
        <Pressable
          key={value}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Answer ${value}`}
          onPress={() => onChoose(value)}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: spacing.md },
  button: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonText: { color: "#fff", fontSize: typography.button, fontFamily: childFonts.bold },
});
