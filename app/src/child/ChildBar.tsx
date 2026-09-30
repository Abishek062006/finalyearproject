/**
 * Always on screen while the child is learning: the four things a child
 * must always be able to say, without words and without a grown-up —
 * "I want to talk", "I need a break", "help me", "I'm all done".
 * Big, same place every time, each its own calm colour.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { haptic } from "../design";
import { childFonts } from "../shared/theme";

export type BarAction = "talk" | "break" | "help" | "all_done";

const BUTTONS: { action: BarAction; label: string; icon: keyof typeof Ionicons.glyphMap; tint: string; fill: string }[] = [
  { action: "talk", label: "Talk", icon: "chatbubbles", tint: "#0071E3", fill: "#DCEAFB" },
  { action: "break", label: "Break", icon: "leaf", tint: "#2E8B57", fill: "#DDF2E3" },
  { action: "help", label: "Help", icon: "help-buoy", tint: "#B7791F", fill: "#FBEFD5" },
  { action: "all_done", label: "All done", icon: "checkmark-done", tint: "#8E44AD", fill: "#EFE2F6" },
];

export function ChildBar({ onAction, bottomInset }: { onAction: (action: BarAction) => void; bottomInset: number }) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 10) }]}>
      {BUTTONS.map((b) => (
        <Pressable
          key={b.action}
          onPress={() => {
            haptic("select");
            onAction(b.action);
          }}
          accessibilityRole="button"
          accessibilityLabel={b.label}
          style={({ pressed }) => [styles.button, { backgroundColor: b.fill }, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <Ionicons name={b.icon} size={28} color={b.tint} />
          <Text style={[styles.label, { color: b.tint }]}>{b.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const CHILD_BAR_HEIGHT = 96;

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D5DDE8",
  },
  button: { flex: 1, maxWidth: 180, minHeight: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontFamily: childFonts.bold, fontSize: 16 },
});
