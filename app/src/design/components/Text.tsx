import React from "react";
import { Text as RNText, TextProps } from "react-native";
import { useTheme } from "../theme";
import { TextVariant } from "../tokens";

type Tone = "primary" | "secondary" | "tertiary" | "tint" | "success" | "destructive" | "onTint";

export function Text({
  variant = "body",
  tone = "primary",
  align,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; tone?: Tone; align?: "left" | "center" | "right" }) {
  const { colors, type } = useTheme();
  const color = {
    primary: colors.label,
    secondary: colors.labelSecondary,
    tertiary: colors.labelTertiary,
    tint: colors.tint,
    success: colors.success,
    destructive: colors.destructive,
    onTint: colors.onTint,
  }[tone];
  return <RNText {...rest} style={[type(variant), { color, textAlign: align }, style]} />;
}
