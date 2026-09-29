import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet } from "react-native";
import { radius, spacing } from "../tokens";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export function Chip({
  label,
  onPress,
  icon,
  selected,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, { backgroundColor: selected ? colors.tint : colors.surface, borderColor: selected ? colors.tint : colors.separator }]}
    >
      {icon && <Ionicons name={icon} size={15} color={selected ? colors.onTint : colors.tint} style={{ marginRight: 6 }} />}
      <Text variant="subhead" style={{ color: selected ? colors.onTint : colors.label, fontWeight: "500" }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
