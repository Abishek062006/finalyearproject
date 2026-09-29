import React, { useState } from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { radius, spacing } from "../tokens";
import { useTheme } from "../theme";
import { Text } from "./Text";

export function TextField({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const { colors, type } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      {label && (
        <Text variant="footnote" tone="secondary" style={styles.label}>
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={colors.labelTertiary}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          type("body"),
          styles.input,
          {
            color: colors.label,
            backgroundColor: colors.surface,
            borderColor: focused ? colors.tint : colors.separator,
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.md },
  label: { marginBottom: 6, marginLeft: spacing.xxs },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
});
