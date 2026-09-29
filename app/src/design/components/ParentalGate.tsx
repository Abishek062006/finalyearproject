/**
 * The only way out of the child space: press and HOLD for 3 seconds. A
 * quick tap (what a curious child does) only shows a short hint and never
 * exits. This is the standard kids-app "parental gate" pattern (App Store
 * Review Guideline 1.3, Kids Category), and it also keeps a child from
 * accidentally leaving mid-activity.
 *
 * Deliberately low-key: small, muted, tucked in a corner — not a big
 * inviting button.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { haptic } from "../haptics";
import { springs } from "../motion";
import { playSound } from "../sound";
import { radius, spacing } from "../tokens";
import { useTheme } from "../theme";
import { Text } from "./Text";

const HOLD_MS = 3000;

export function ParentalGate({ onUnlock, label = "Grown-ups" }: { onUnlock: () => void; label?: string }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlocked = useRef(false);

  useEffect(
    () => () => {
      stopTimers();
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    []
  );

  function complete() {
    if (unlocked.current) return;
    unlocked.current = true;
    stopTimers();
    haptic("unlock");
    playSound("unlock");
    onUnlock();
  }

  function stopTimers() {
    if (tickTimer.current) clearInterval(tickTimer.current);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    tickTimer.current = null;
    holdTimer.current = null;
  }

  function start() {
    setHolding(true);
    setShowHint(false);
    haptic("tick");
    tickTimer.current = setInterval(() => haptic("tick"), 1000);
    // The timer decides when the gate opens; the fill is purely visual, so a
    // janky frame rate can never make unlocking faster or slower.
    holdTimer.current = setTimeout(complete, HOLD_MS);
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
  }

  function release() {
    stopTimers();
    setHolding(false);
    if (unlocked.current) return;
    cancelAnimation(progress);
    progress.value = withSpring(0, springs.gentle);
    setShowHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setShowHint(false), 2200);
  }

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={styles.wrap}>
      <Pressable
        onPressIn={start}
        onPressOut={release}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Press and hold for 3 seconds to leave the child space.`}
        style={[styles.pill, { backgroundColor: "rgba(255,255,255,0.75)", borderColor: colors.separator }]}
      >
        <Animated.View style={[styles.fill, { backgroundColor: colors.tintSoft }, fillStyle]} />
        <Ionicons name="lock-closed" size={13} color={colors.labelSecondary} />
        <Text variant="caption" tone="secondary" style={{ marginLeft: 6 }}>
          {holding ? "Keep holding…" : label}
        </Text>
      </Pressable>
      {showHint && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={[styles.hint, { backgroundColor: colors.label }]}>
          <Text variant="caption" style={{ color: colors.surface }}>
            Grown-ups: hold for 3 seconds
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "flex-end" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  hint: { marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm },
});
