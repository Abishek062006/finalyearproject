/**
 * modality = "drag_drop" (README §1). A genuinely different gesture from
 * TapAnswer, not the same tap dressed up — number tiles are dragged into a
 * drop zone, and release position (not a press event) decides the answer.
 */
import React, { useMemo, useRef } from "react";
import { Animated, LayoutRectangle, PanResponder, StyleSheet, Text, View } from "react-native";
import { colors, MIN_TOUCH_TARGET, radius, spacing, typography, childFonts } from "../shared/theme";

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function DragTile({
  value,
  dropZone,
  onDropped,
  disabled,
}: {
  value: string | number;
  dropZone: React.MutableRefObject<LayoutRectangle | null>;
  onDropped: (value: string | number) => void;
  disabled: boolean;
}) {
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_evt, gesture) => {
        const zone = dropZone.current;
        const inside =
          zone &&
          gesture.moveX >= zone.x &&
          gesture.moveX <= zone.x + zone.width &&
          gesture.moveY >= zone.y &&
          gesture.moveY <= zone.y + zone.height;

        if (inside) {
          onDropped(value);
        }
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.tile, { transform: pan.getTranslateTransform() }]}
    >
      <Text style={styles.tileText}>{value}</Text>
    </Animated.View>
  );
}

export function DragDropAnswer({
  choices,
  onChoose,
  disabled,
}: {
  choices: (string | number)[];
  onChoose: (value: string | number) => void;
  disabled: boolean;
}) {
  // See TapAnswer.tsx: depend on values, not array reference, or tiles
  // reshuffle under the child's finger on any unrelated re-render.
  const options = useMemo(() => shuffled(choices), [choices.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const dropZone = useRef<LayoutRectangle | null>(null);
  // measureInWindow is a method on the component instance (accessed via a
  // ref), NOT on the onLayout event's currentTarget — `e.currentTarget` is a
  // plain layout-event target on web and has no such method, which silently
  // crashed here and left dropZone.current permanently null (every drag
  // then failed its containment check with no visible error until checked
  // via the browser console). Always measure through a ref.
  const dropZoneRef = useRef<View>(null);

  const measureDropZone = () => {
    dropZoneRef.current?.measureInWindow((x, y, width, height) => {
      dropZone.current = { x, y, width, height };
    });
  };

  return (
    <View>
      <View ref={dropZoneRef} style={styles.dropZone} onLayout={measureDropZone}>
        <Text style={styles.dropZoneLabel}>Drop it here!</Text>
      </View>
      <View style={styles.tileRow}>
        {options.map((value) => (
          <DragTile key={value} value={value} dropZone={dropZone} onDropped={onChoose} disabled={disabled} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dropZone: {
    height: 96,
    borderRadius: radius.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceMuted,
  },
  dropZoneLabel: { color: colors.textSecondary, fontSize: 18, fontFamily: childFonts.regular },
  tileRow: { flexDirection: "row", justifyContent: "center", gap: spacing.md },
  tile: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { color: "#fff", fontSize: typography.button, fontFamily: childFonts.bold },
});
