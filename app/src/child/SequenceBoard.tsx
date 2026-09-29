/**
 * activity_kind = "sequencing" (docs/PLAN.md Phase B). Another genuinely
 * different interaction: tiles are tapped in ascending order into a slot
 * row, instead of picking one choice out of several.
 *
 * Ties into the existing teaching_method axis (README's errorless vs
 * try_then_correct) instead of ignoring it like matching does: an "errorless"
 * wrong tap is just ignored (no outcome recorded, child keeps trying) so the
 * child can never fail visibly; "try_then_correct" records one wrong outcome
 * against the item currently being sought, then still requires the correct
 * tap to advance.
 */
import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, MIN_TOUCH_TARGET, radius, spacing, typography, childFonts } from "../shared/theme";

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface SequenceItem {
  id: string;
  value: number;
  position: number;
}

export function SequenceBoard({
  items,
  method,
  onItemAnswered,
  onAllDone,
  disabled,
}: {
  items: SequenceItem[];
  method: "errorless" | "try_then_correct" | null;
  onItemAnswered: (itemId: string, correct: boolean, responseTimeMs: number) => void;
  onAllDone: () => void;
  disabled: boolean;
}) {
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const wrongAlreadyRecorded = useRef<Set<string>>(new Set());
  const expectedStartedAt = useRef<number>(Date.now());

  const sortedByPosition = useMemo(() => [...items].sort((a, b) => a.position - b.position), [items]);
  // Depend on ids, not array reference — see TapAnswer.tsx.
  const tiles = useMemo(() => shuffled(items), [items.map((i) => i.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const expectedItem = sortedByPosition[placedIds.length];

  function handleTileTap(tile: SequenceItem) {
    if (disabled || placedIds.includes(tile.id)) return;

    if (tile.id === expectedItem.id) {
      const responseTimeMs = Date.now() - expectedStartedAt.current;
      const nextPlaced = [...placedIds, tile.id];
      setPlacedIds(nextPlaced);
      expectedStartedAt.current = Date.now();
      onItemAnswered(tile.id, true, responseTimeMs);
      if (nextPlaced.length === items.length) {
        setTimeout(onAllDone, 600);
      }
      return;
    }

    setShakeId(tile.id);
    setTimeout(() => setShakeId(null), 400);
    if (method === "try_then_correct" && !wrongAlreadyRecorded.current.has(expectedItem.id)) {
      wrongAlreadyRecorded.current.add(expectedItem.id);
      const responseTimeMs = Date.now() - expectedStartedAt.current;
      onItemAnswered(expectedItem.id, false, responseTimeMs);
    }
    // "errorless": no outcome recorded at all — a wrong tap just bounces,
    // never counted as a failure (README §31/§1).
  }

  return (
    <View>
      <View style={styles.slotRow}>
        {sortedByPosition.map((item, i) => (
          <View key={item.id} style={[styles.slot, placedIds.includes(item.id) && styles.slotFilled]}>
            <Text style={styles.slotText}>{placedIds.includes(item.id) ? item.value : i + 1}</Text>
          </View>
        ))}
      </View>
      <View style={styles.tileRow}>
        {tiles.map((tile) => {
          const isPlaced = placedIds.includes(tile.id);
          return (
            <Pressable
              key={tile.id}
              disabled={disabled || isPlaced}
              onPress={() => handleTileTap(tile)}
              style={[styles.tile, isPlaced && styles.tilePlaced, shakeId === tile.id && styles.tileShake]}
            >
              {!isPlaced && <Text style={styles.tileText}>{tile.value}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slotRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.lg },
  slot: {
    width: MIN_TOUCH_TARGET * 0.7,
    height: MIN_TOUCH_TARGET * 0.7,
    borderRadius: radius.button,
    borderWidth: 3,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  slotFilled: { borderStyle: "solid", backgroundColor: colors.success, borderColor: colors.success },
  slotText: { fontSize: typography.button * 0.7, fontFamily: childFonts.bold, color: colors.textPrimary },
  tileRow: { flexDirection: "row", justifyContent: "center", gap: spacing.md },
  tile: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  tilePlaced: { backgroundColor: colors.background, opacity: 0 },
  // Never red or orange (README §31) — a neutral gray nudge, same as MatchingBoard.tsx.
  tileShake: { backgroundColor: colors.incorrectSoft },
  tileText: { color: "#fff", fontSize: typography.button, fontFamily: childFonts.bold },
});
