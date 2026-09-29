/**
 * activity_kind = "matching" (docs/PLAN.md Phase B). A genuinely different
 * interaction from tap/drag-drop: the WHOLE item set is shown at once as a
 * letter <-> picture matching puzzle, instead of one choice at a time.
 *
 * Flow: tap a letter card (left), then tap a picture card (right) — the
 * pairing is the answer, resolved the moment both are picked. One answer
 * per letter, same as every other activity kind (no repeated re-tries
 * inflating mastery evidence).
 */
import React, { useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, LETTER_MNEMONIC, MIN_TOUCH_TARGET, radius, spacing, typography, childFonts } from "../shared/theme";

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface MatchingItem {
  id: string;
  label: string;
}

export function MatchingBoard({
  items,
  onItemAnswered,
  onAllDone,
  disabled,
}: {
  items: MatchingItem[];
  onItemAnswered: (itemId: string, correct: boolean, responseTimeMs: number) => void;
  onAllDone: () => void;
  disabled: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, boolean>>({}); // itemId -> was it correct
  // Keyed separately from `resolved`: the picture just TAPPED isn't
  // necessarily the picture whose own id equals the letter being resolved
  // (a wrong tap picks some OTHER item's picture), so the flash needs its
  // own {id, correct} rather than reading resolved[picture.id].
  const [flash, setFlash] = useState<{ id: string; correct: boolean } | null>(null);
  const selectedAt = useRef<number>(Date.now());

  // Depend on ids, not array reference, so pictures never reshuffle under
  // the child's finger on an unrelated re-render (see TapAnswer.tsx).
  const pictures = useMemo(() => shuffled(items), [items.map((i) => i.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLeftTap(item: MatchingItem) {
    if (disabled || resolved[item.id] !== undefined) return;
    setSelectedId(item.id);
    selectedAt.current = Date.now();
  }

  function handleRightTap(picture: MatchingItem) {
    if (disabled || !selectedId || resolved[picture.id] !== undefined) return;
    const selectedItem = items.find((i) => i.id === selectedId)!;
    const correct = selectedItem.label === picture.label;
    const responseTimeMs = Date.now() - selectedAt.current;

    const nextResolved = { ...resolved, [selectedId]: correct };
    setResolved(nextResolved);
    setFlash({ id: picture.id, correct });
    setTimeout(() => setFlash(null), 500);
    setSelectedId(null);
    onItemAnswered(selectedId, correct, responseTimeMs);

    if (Object.keys(nextResolved).length === items.length) {
      setTimeout(onAllDone, 600);
    }
  }

  return (
    <View style={styles.board}>
      <View style={styles.column}>
        {items.map((item) => {
          const state = resolved[item.id];
          return (
            <Pressable
              key={item.id}
              disabled={disabled || state !== undefined}
              onPress={() => handleLeftTap(item)}
              style={[
                styles.card,
                item.id === selectedId && styles.cardSelected,
                state === true && styles.cardCorrect,
                state === false && styles.cardIncorrect,
              ]}
            >
              <Text style={styles.cardText}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.column}>
        {pictures.map((picture) => (
          <Pressable
            key={picture.id}
            disabled={disabled || !selectedId || resolved[picture.id] !== undefined}
            onPress={() => handleRightTap(picture)}
            style={[
              styles.card,
              styles.pictureCard,
              flash?.id === picture.id && flash.correct && styles.cardCorrect,
              flash?.id === picture.id && !flash.correct && styles.cardIncorrect,
            ]}
          >
            <Image source={LETTER_MNEMONIC[picture.label]} style={styles.pictureImage} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flexDirection: "row", justifyContent: "center", gap: spacing.xl, marginBottom: spacing.lg },
  column: { gap: spacing.sm },
  card: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET * 0.7,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  pictureCard: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: "hidden",
  },
  cardSelected: { backgroundColor: colors.primaryDark },
  cardCorrect: { backgroundColor: colors.success, borderColor: colors.success },
  // Never red or orange (README §31: no punitive feedback) — the same
  // neutral gray nudge used for a "try again" state everywhere in this app.
  cardIncorrect: { backgroundColor: colors.incorrectSoft, borderColor: colors.incorrectSoft },
  cardText: { color: "#fff", fontSize: typography.button, fontFamily: childFonts.bold },
  pictureImage: { width: "100%", height: "100%", borderRadius: radius.button - 6 },
});
