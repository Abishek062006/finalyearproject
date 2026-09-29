/**
 * LEGACY primitive names, kept so the not-yet-rebuilt Parent/Educator
 * screens keep compiling — each one now just delegates to the design system
 * (src/design), so those screens already get the new buttons, fields, press
 * physics and haptics. New code should import from src/design directly.
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Button, Card as DSCard, springs, Text, TextField, useTheme } from "../design";

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <DSCard style={style}>{children}</DSCard>;
}

export function ScreenTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="title2" accessibilityRole="header" style={{ marginBottom: 12 }}>
      {children}
    </Text>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="headline" style={{ marginBottom: 8 }}>
      {children}
    </Text>
  );
}

export function PrimaryButton({ title, onPress, disabled, loading }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return <Button title={title} onPress={onPress} disabled={disabled} loading={loading} />;
}

export function SecondaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return <Button title={title} onPress={onPress} variant="plain" size="medium" fullWidth />;
}

export function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = "none",
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
    />
  );
}

export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const { colors } = useTheme();
  const width = useSharedValue(0);
  const clamped = Math.max(0, Math.min(100, percent));

  useEffect(() => {
    width.value = withSpring(clamped, springs.gentle);
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View
      style={[styles.track, { backgroundColor: colors.fill }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color ?? colors.tint }, fillStyle]} />
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <Text variant="footnote" tone="destructive" style={{ marginBottom: 12 }}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});
