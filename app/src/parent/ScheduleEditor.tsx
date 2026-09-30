/**
 * Parent side of "My day": build the child's visual schedule — a short
 * list of steps, each with a picture — which the child then sees as a
 * First-Then board and ticks off. Kept deliberately short (≤ 12 steps).
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, haptic, radius, spacing, Text, TextField, useTheme } from "../design";
import { SCHEDULE_ICONS, ScheduleIcon, ScheduleStep } from "../shared/api";

const MAX_STEPS = 12;

const EXAMPLE_DAY: Omit<ScheduleStep, "id">[] = [
  { label: "Breakfast", icon: "restaurant" },
  { label: "Get dressed", icon: "shirt" },
  { label: "Learning time", icon: "star" },
  { label: "Play outside", icon: "football" },
  { label: "Lunch", icon: "restaurant" },
  { label: "Bath", icon: "water" },
  { label: "Bedtime", icon: "bed" },
];

const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function ScheduleEditor({ steps, onChange }: { steps: ScheduleStep[]; onChange: (steps: ScheduleStep[]) => void }) {
  const { colors } = useTheme();
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<ScheduleIcon>("star");

  function add() {
    if (!label.trim() || steps.length >= MAX_STEPS) return;
    haptic("select");
    onChange([...steps, { id: newId(), label: label.trim(), icon }]);
    setLabel("");
  }

  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <View>
      <Text variant="footnote" tone="secondary" style={styles.intro}>
        Your child sees the steps in order, with what's happening now and what comes next. Short plans work best.
      </Text>

      {steps.length === 0 && (
        <Button
          title="Start from an example day"
          variant="tinted"
          icon="sparkles"
          onPress={() => onChange(EXAMPLE_DAY.map((s) => ({ ...s, id: newId() })))}
        />
      )}

      <View style={[styles.list, { backgroundColor: colors.surface }]}>
        {steps.map((s, i) => (
          <View key={s.id} style={[styles.row, i < steps.length - 1 && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.stepIcon, { backgroundColor: colors.fill }]}>
              <Ionicons name={s.icon} size={20} color={colors.label} />
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {i + 1}. {s.label}
            </Text>
            <IconButton name="chevron-up" label={`Move ${s.label} earlier`} disabled={i === 0} onPress={() => move(i, -1)} />
            <IconButton name="chevron-down" label={`Move ${s.label} later`} disabled={i === steps.length - 1} onPress={() => move(i, 1)} />
            <IconButton name="trash-outline" label={`Remove ${s.label}`} destructive onPress={() => onChange(steps.filter((x) => x.id !== s.id))} />
          </View>
        ))}
      </View>

      {steps.length < MAX_STEPS ? (
        <View style={{ marginTop: spacing.lg }}>
          <TextField label="Add a step" placeholder="e.g. Park" value={label} onChangeText={setLabel} maxLength={40} onSubmitEditing={add} />
          <Text variant="footnote" tone="secondary" style={styles.pickLabel}>
            Picture
          </Text>
          <View style={styles.icons}>
            {SCHEDULE_ICONS.map((name) => (
              <Pressable
                key={name}
                onPress={() => setIcon(name)}
                accessibilityRole="button"
                accessibilityLabel={name.replace("-", " ")}
                aria-selected={icon === name}
                style={[styles.iconChoice, { backgroundColor: icon === name ? colors.tint : colors.surface }]}
              >
                <Ionicons name={name} size={22} color={icon === name ? colors.onTint : colors.label} />
              </Pressable>
            ))}
          </View>
          <Button title="Add step" variant="tinted" icon="add" onPress={add} disabled={!label.trim()} />
        </View>
      ) : (
        <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.md }}>
          That's the most steps a day can have.
        </Text>
      )}
    </View>
  );
}

function IconButton({ name, label, onPress, disabled, destructive }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; destructive?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={[styles.iconButton, disabled && { opacity: 0.3 }]}>
      <Ionicons name={name} size={20} color={destructive ? colors.destructive : colors.tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.md, marginLeft: spacing.xxs },
  list: { borderRadius: radius.lg, overflow: "hidden", marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 10, paddingHorizontal: spacing.md },
  stepIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  pickLabel: { marginLeft: spacing.xxs, marginBottom: spacing.xs },
  icons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  iconChoice: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
