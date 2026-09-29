/**
 * The one pressable primitive everything tappable is built on: springs down
 * while held, springs back on release, and fires a semantic haptic (and
 * optionally a sound) on press. Keeps the whole app's touch feel consistent.
 */
import React from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { haptic, HapticEvent } from "../haptics";
import { springs, pressScale } from "../motion";
import { playSound, SoundEvent } from "../sound";
import { useTheme } from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  haptic?: HapticEvent | null;
  sound?: SoundEvent | null;
  scaleTo?: number;
};

export function PressableScale({
  style,
  haptic: hapticEvent = "tap",
  sound = null,
  scaleTo,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  accessibilityRole = "button",
  ...rest
}: PressableScaleProps) {
  const { space } = useTheme();
  const scale = useSharedValue(1);
  const target = scaleTo ?? (space === "child" ? pressScale.child : pressScale.parent);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={(e) => {
        scale.value = withSpring(target, springs.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, springs.press);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticEvent) haptic(hapticEvent);
        if (sound) playSound(sound);
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
    />
  );
}
