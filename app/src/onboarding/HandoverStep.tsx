/**
 * The last onboarding screen: teaches the grown-up how to get back out of
 * the child space (the press-and-hold lock) before handing the tablet over.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Buddy } from "../companion/Buddy";
import { useBuddy } from "../companion/useBuddy";
import { radius, spacing, Text, useTheme } from "../design";
import { API_BASE, Child } from "../shared/api";

export function HandoverStep({ child }: { child: Child }) {
  const { colors } = useTheme();
  const buddy = useBuddy();
  useEffect(() => {
    buddy.setMood("happy");
    const t = setTimeout(() => buddy.gesture("wave"), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ marginBottom: spacing.lg }}>
        <Buddy buddy={buddy} size={130} holdingUri={child.companion_image_url ? `${API_BASE}${child.companion_image_url}` : null} />
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={[styles.pill, { borderColor: colors.separator }]}>
          <Ionicons name="lock-closed" size={13} color={colors.labelSecondary} />
          <Text variant="caption" tone="secondary" style={{ marginLeft: 6 }}>
            Grown-ups
          </Text>
        </View>
        <Text variant="headline" align="center" style={{ marginTop: spacing.md }}>
          To come back, press and hold this for 3 seconds
        </Text>
        <Text variant="subhead" tone="secondary" align="center" style={{ marginTop: 4 }}>
          It sits in the top corner of {child.nickname}'s space. A quick tap does nothing, so {child.nickname} can't leave by accident.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.xl, alignItems: "center", maxWidth: 420 },
  pill: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, height: 32, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
});
