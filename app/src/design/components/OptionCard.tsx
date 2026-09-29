/**
 * A big, tappable answer card for onboarding-style questions. `kind` sets
 * the indicator: a radio dot for "pick one", a checkbox for "pick any".
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { radius, spacing } from "../tokens";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export function OptionCard({
  title,
  subtitle,
  icon,
  iconColor,
  selected,
  onPress,
  kind = "single",
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  selected: boolean;
  onPress: () => void;
  kind?: "single" | "multi";
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      accessibilityRole={kind === "single" ? "radio" : "checkbox"}
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.tintSoft : colors.surface,
          borderColor: selected ? colors.tint : "transparent",
        },
      ]}
    >
      {icon && (
        <View style={[styles.icon, { backgroundColor: iconColor ?? colors.tint }]}>
          <Ionicons name={icon} size={22} color="#fff" />
        </View>
      )}
      <View style={styles.text}>
        <Text variant="headline">{title}</Text>
        {subtitle && (
          <Text variant="subhead" tone="secondary" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      <Indicator kind={kind} selected={selected} />
    </PressableScale>
  );
}

function Indicator({ kind, selected }: { kind: "single" | "multi"; selected: boolean }) {
  const { colors } = useTheme();
  if (kind === "multi") {
    return (
      <View style={[styles.box, { borderColor: selected ? colors.tint : colors.separator, backgroundColor: selected ? colors.tint : "transparent" }]}>
        {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
    );
  }
  return (
    <View style={[styles.radio, { borderColor: selected ? colors.tint : colors.separator }]}>
      {selected && <View style={[styles.radioDot, { backgroundColor: colors.tint }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    marginBottom: spacing.sm,
    minHeight: 72,
  },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  text: { flex: 1, marginRight: spacing.sm },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
