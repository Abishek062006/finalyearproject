import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { radius, spacing } from "../tokens";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export type ButtonVariant = "filled" | "tinted" | "plain" | "destructive";

export function Button({
  title,
  onPress,
  variant = "filled",
  size = "large",
  icon,
  loading,
  disabled,
  fullWidth = size === "large",
  style,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: "large" | "medium";
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { colors, space } = useTheme();
  const palette = {
    filled: { bg: colors.tint, fg: colors.onTint },
    tinted: { bg: colors.tintSoft, fg: colors.tint },
    plain: { bg: "transparent", fg: colors.tint },
    destructive: { bg: colors.destructiveSoft, fg: colors.destructive },
  }[variant];

  const height = size === "large" ? (space === "child" ? 64 : 52) : 38;
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      style={[
        styles.base,
        {
          height,
          backgroundColor: palette.bg,
          borderRadius: size === "large" ? radius.lg : radius.md,
          paddingHorizontal: size === "large" ? spacing.lg : spacing.md,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={size === "large" ? 20 : 17} color={palette.fg} style={{ marginRight: spacing.xs }} />}
          <Text variant={size === "large" ? "headline" : "subhead"} style={{ color: palette.fg, fontWeight: space === "child" ? undefined : "600" }}>
            {title}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center" },
});
