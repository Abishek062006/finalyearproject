/**
 * Choose a learning friend: the selected one stands large and alive, waves
 * and introduces itself; the rest wait in a grid below. Small tiles use
 * reduced motion (blinking only) so ten animated characters never compete
 * for attention — calm by default.
 */
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { PressableScale, radius, spacing, Text, useTheme } from "../design";
import { Buddy } from "./Buddy";
import { SPECIES_LIST, SpeciesCode, speciesFor } from "./species";
import { useBuddy } from "./useBuddy";

export function BuddyPicker({
  value,
  onChange,
  displayName,
  childName,
}: {
  value: SpeciesCode;
  onChange: (code: SpeciesCode) => void;
  /** Overrides the species' own name in the introduction (a custom name). */
  displayName?: string;
  childName?: string;
}) {
  const { colors } = useTheme();
  const star = useBuddy();
  const first = useRef(true);
  const selected = speciesFor(value);
  const name = displayName?.trim() || selected.name;

  useEffect(() => {
    star.enter();
    if (first.current) {
      first.current = false;
      return;
    }
    star.gesture("wave");
    star.say(childName ? `Hi ${childName}! I'm ${name}!` : `Hi! I'm ${name}!`, { mood: "happy" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <View>
      <View style={[styles.stage, { backgroundColor: colors.surface }]}>
        <Buddy buddy={star} size={150} species={value} />
        <Text variant="title2" align="center" style={{ marginTop: spacing.xs }}>
          {name}
        </Text>
        <Text variant="subhead" tone="secondary" align="center">
          {selected.blurb}
        </Text>
      </View>

      <View style={styles.grid} accessibilityRole="radiogroup">
        {SPECIES_LIST.map((s) => (
          <Tile key={s.code} code={s.code} name={s.name} selected={s.code === value} onPress={() => onChange(s.code)} />
        ))}
      </View>
    </View>
  );
}

function Tile({ code, name, selected, onPress }: { code: SpeciesCode; name: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const buddy = useBuddy({ reduceMotion: true });
  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected, selected }}
      style={[styles.tile, { backgroundColor: selected ? colors.tintSoft : colors.surface, borderColor: selected ? colors.tint : "transparent" }]}
    >
      <Buddy buddy={buddy} size={58} species={code} />
      <Text variant="caption" style={{ marginTop: 2, fontWeight: selected ? "600" : "400" }}>
        {name}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: "center", borderRadius: radius.xl, paddingVertical: spacing.lg, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xs },
  tile: { width: 84, alignItems: "center", paddingVertical: spacing.xs, borderRadius: radius.lg, borderWidth: 2 },
});
