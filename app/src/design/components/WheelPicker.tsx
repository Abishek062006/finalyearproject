/**
 * An iOS-style scroll wheel: rows fade and shrink with distance from the
 * centre, a rounded band marks the selection, and the wheel snaps to the
 * nearest row once scrolling stops (with a selection haptic).
 *
 * Snapping is driven by a short "settle" timer that every scroll event
 * resets, rather than by momentum-end events alone — web mouse wheels and
 * trackpads never emit those. While a finger is still down it never snaps,
 * so the wheel can't jump out from under the child's or parent's finger.
 */
import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { haptic } from "../haptics";
import { radius } from "../tokens";
import { useTheme } from "../theme";
import { Text } from "./Text";

const ROW = 44;
const VISIBLE = 5;
const SETTLE_MS = 120;

export function WheelPicker<T extends string | number>({
  items,
  value,
  onChange,
  width,
  accessibilityLabel,
}: {
  items: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  width?: number;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const ref = useRef<ScrollView>(null);
  const scrollY = useSharedValue(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  const lastIndex = useRef(Math.max(0, items.findIndex((i) => i.value === value)));

  useEffect(() => {
    const index = Math.max(0, items.findIndex((i) => i.value === value));
    lastIndex.current = index;
    // Deferred one tick so the ScrollView has laid out before jumping to the value.
    const t = setTimeout(() => ref.current?.scrollTo({ y: index * ROW, animated: false }), 0);
    return () => {
      clearTimeout(t);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // Only when the list itself changes — not on values this wheel emitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function scheduleSettle(y: number) {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (dragging.current) return;
    settleTimer.current = setTimeout(() => {
      const index = Math.min(items.length - 1, Math.max(0, Math.round(y / ROW)));
      if (Math.abs(y - index * ROW) > 0.5) ref.current?.scrollTo({ y: index * ROW, animated: true });
      if (index !== lastIndex.current) {
        lastIndex.current = index;
        haptic("select");
        onChange(items[index].value);
      }
    }, SETTLE_MS);
  }

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    scheduleOnRN(scheduleSettle, e.contentOffset.y);
  });

  function step(delta: number) {
    const next = lastIndex.current + delta;
    if (next < 0 || next >= items.length) return;
    lastIndex.current = next;
    ref.current?.scrollTo({ y: next * ROW, animated: true });
    onChange(items[next].value);
  }

  return (
    <View
      style={{ height: ROW * VISIBLE, width, overflow: "hidden" }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[lastIndex.current]?.label }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      <View pointerEvents="none" style={[styles.band, { backgroundColor: colors.fill }]} />
      <Animated.ScrollView
        ref={ref as never}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: (ROW * (VISIBLE - 1)) / 2 }}
        onScrollBeginDrag={() => {
          dragging.current = true;
          if (settleTimer.current) clearTimeout(settleTimer.current);
        }}
        onScrollEndDrag={(e) => {
          dragging.current = false;
          scheduleSettle(e.nativeEvent.contentOffset.y);
        }}
      >
        {items.map((item, i) => (
          <WheelRow key={String(item.value)} label={item.label} index={i} scrollY={scrollY} />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

function WheelRow({ label, index, scrollY }: { label: string; index: number; scrollY: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollY.value / ROW - index);
    return {
      opacity: interpolate(distance, [0, 1, 2.5], [1, 0.45, 0.15], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [0, 2], [1, 0.86], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={[styles.row, style]}>
      <Text variant="title3" style={{ fontWeight: "500" }}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { position: "absolute", left: 6, right: 6, top: ROW * 2, height: ROW, borderRadius: radius.md - 2 },
  row: { height: ROW, alignItems: "center", justifyContent: "center" },
});
