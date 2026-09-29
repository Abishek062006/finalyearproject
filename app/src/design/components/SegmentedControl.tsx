/**
 * iOS-style segmented control: a sliding thumb that springs to the selected
 * segment. Equal-width segments, so the thumb's position is just
 * index * segmentWidth once the container has been measured.
 */
import React, { useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { haptic } from "../haptics";
import { springs } from "../motion";
import { radius } from "../tokens";
import { useTheme } from "../theme";
import { Text } from "./Text";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - 4) / options.length : 0;
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const thumbStyle = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withSpring(index * segment, springs.press) }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.fill }]}
    >
      {segment > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: scheme === "dark" ? colors.surfaceElevated : colors.surface },
            thumbStyle,
          ]}
        />
      )}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                haptic("select");
                onChange(o.value);
              }
            }}
            style={styles.segment}
          >
            <Text variant="subhead" numberOfLines={1} style={{ fontWeight: selected ? "600" : "400" }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: radius.md - 3, padding: 2, height: 36 },
  thumb: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: radius.md - 5,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
});
