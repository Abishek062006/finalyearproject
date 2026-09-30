/**
 * The routine lesson: the steps of an everyday routine (washing hands,
 * brushing teeth, getting dressed) arrive as a jumbled pile of picture
 * cards; the child lays them in order along the strip — "what do we do
 * first?". Same teaching-method rules as the train: "errorless" never
 * records a wrong tap; "try_then_correct" records one miss per step.
 */
import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { childFonts } from "../../shared/theme";

export interface RoutineCard {
  id: string;
  position: number;
  label: string;
  icon: string; // an emoji picture of the step (see backend seed ROUTINES)
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function RoutineBoard({
  title,
  promptText,
  items,
  method,
  onItemAnswered,
  onAllDone,
  disabled,
}: {
  title: string;
  promptText: string;
  items: RoutineCard[];
  method: "errorless" | "try_then_correct" | null;
  onItemAnswered: (itemId: string, correct: boolean, responseTimeMs: number) => void;
  onAllDone: () => void;
  disabled: boolean;
}) {
  const [placed, setPlaced] = useState<string[]>([]);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const missRecorded = useRef<Set<string>>(new Set());
  const soughtSince = useRef(Date.now());
  const inOrder = useMemo(() => [...items].sort((a, b) => a.position - b.position), [items]);
  const pile = useMemo(() => shuffled(items), [items.map((i) => i.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const sought = inOrder[placed.length];

  function tap(card: RoutineCard) {
    if (disabled || placed.includes(card.id) || !sought) return;
    const rt = Date.now() - soughtSince.current;
    if (card.id === sought.id) {
      const next = [...placed, card.id];
      setPlaced(next);
      soughtSince.current = Date.now();
      onItemAnswered(card.id, true, rt);
      if (next.length === items.length) setTimeout(onAllDone, 700);
      return;
    }
    setShakeId(card.id);
    setTimeout(() => setShakeId(null), 420);
    if (method === "try_then_correct" && !missRecorded.current.has(sought.id)) {
      missRecorded.current.add(sought.id);
      onItemAnswered(sought.id, false, rt);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.prompt}>{promptText}</Text>

      <View style={styles.strip}>
        {inOrder.map((step, i) => {
          const on = placed.includes(step.id);
          return (
            <View key={step.id} style={[styles.slot, on && styles.slotFilled]}>
              <Text style={[styles.slotNumber, on && { color: "#248A3D" }]}>{i + 1}</Text>
              {on ? (
                <>
                  <Text style={styles.slotPicture}>{step.icon}</Text>
                  <Text style={styles.slotLabel} numberOfLines={2}>
                    {step.label}
                  </Text>
                </>
              ) : (
                <View style={styles.slotEmpty} />
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.pile}>
        {pile.map((step) => {
          const on = placed.includes(step.id);
          return (
            <Pressable
              key={step.id}
              onPress={() => tap(step)}
              disabled={disabled || on}
              accessibilityRole="button"
              accessibilityLabel={step.label}
              style={[styles.stepCard, on && styles.stepGone, shakeId === step.id && styles.stepShake]}
            >
              <Text style={styles.stepPicture}>{step.icon}</Text>
              <Text style={styles.stepLabel} numberOfLines={2}>
                {step.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: "rgba(29,36,51,0.08)",
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: { fontSize: 16, color: "#5B6475", fontFamily: childFonts.bold, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 },
  prompt: { fontSize: 24, color: "#1D2433", fontFamily: childFonts.bold, textAlign: "center", marginTop: 4, marginBottom: 16 },
  strip: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 20 },
  slot: {
    width: 104,
    minHeight: 112,
    borderRadius: 18,
    borderWidth: 2.5,
    borderStyle: "dashed",
    borderColor: "#C9D2E0",
    alignItems: "center",
    padding: 6,
    gap: 2,
  },
  slotFilled: { borderStyle: "solid", borderColor: "#7CC26B", backgroundColor: "#EEF8EA" },
  slotNumber: { fontFamily: childFonts.bold, fontSize: 16, color: "#9AA3B2" },
  slotEmpty: { flex: 1 },
  slotPicture: { fontSize: 34, lineHeight: 42 },
  stepPicture: { fontSize: 44, lineHeight: 54 },
  slotLabel: { fontFamily: childFonts.bold, fontSize: 13, color: "#1D2433", textAlign: "center" },
  pile: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  stepCard: {
    width: 120,
    minHeight: 120,
    borderRadius: 20,
    backgroundColor: "#FFF6E5",
    borderWidth: 2.5,
    borderColor: "#E9C58F",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    gap: 4,
  },
  stepGone: { opacity: 0 },
  // Never red (README §31) — a soft grey nudge.
  stepShake: { backgroundColor: "#E4EAF2", borderColor: "#C9D2E0", transform: [{ rotate: "-4deg" }] },
  stepLabel: { fontFamily: childFonts.bold, fontSize: 15, color: "#1D2433", textAlign: "center" },
});
