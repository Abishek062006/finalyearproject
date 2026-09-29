import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { radius, spacing } from "../tokens";
import { useTheme } from "../theme";

export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: padded ? spacing.md : 0,
          marginBottom: spacing.md,
        },
        scheme === "light" && {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
