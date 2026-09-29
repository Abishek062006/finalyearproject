/**
 * Pip plus a speech bubble. The bubble always shows what Pip is saying, so
 * the words are available even with sound off, and to a screen reader
 * (as a live region).
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { radius, spacing, Text, useTheme } from "../design";
import { Buddy } from "./Buddy";
import { BuddyController } from "./useBuddy";

export function CompanionStage({ buddy, holdingUri, size = 128 }: { buddy: BuddyController; holdingUri?: string | null; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Buddy buddy={buddy} size={size} holdingUri={holdingUri} />
      {buddy.caption && (
        <Animated.View
          key={buddy.caption}
          entering={FadeIn.duration(160)}
          style={[styles.bubble, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}
          accessibilityLiveRegion="polite"
          aria-live="polite"
        >
          <View style={[styles.tail, { borderRightColor: colors.surface }]} />
          <Text variant="headline">{buddy.caption}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  bubble: {
    flex: 1,
    marginLeft: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tail: {
    position: "absolute",
    left: -10,
    top: "50%",
    marginTop: -8,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 11,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
});
