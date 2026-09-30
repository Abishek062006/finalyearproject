/**
 * The answer pieces a scene is played with — wooden number blocks for the
 * basket, envelopes for the mailbox — and how they move. Both modalities act
 * on the same real object (README §1): "tap" sends the piece to the scene's
 * target by itself; "drag_drop" has the child carry it there. A right answer
 * lands in the target and stays; a wrong one wobbles and goes back home.
 */
import React, { useMemo, useRef } from "react";
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { childFonts } from "../../shared/theme";

export type PieceKind = "block" | "envelope";

type Rect4 = { x: number; y: number; width: number; height: number };

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function measure(view: View | null): Promise<Rect4 | null> {
  return new Promise((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

export function SceneChoices({
  kind,
  modality,
  choices,
  correctValue,
  targetRef,
  onChoose,
  disabled,
  reduceMotion,
}: {
  kind: PieceKind;
  modality: "tap" | "drag_drop";
  choices: (string | number)[];
  correctValue: string | number;
  targetRef: React.RefObject<View | null>;
  onChoose: (value: string | number) => void;
  disabled: boolean;
  reduceMotion: boolean;
}) {
  // Depend on the values, not the array reference, or pieces reshuffle under the child's finger.
  const options = useMemo(() => shuffled(choices), [choices.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = useRef(false);

  return (
    <View style={styles.row}>
      {options.map((value) => (
        <Piece
          key={value}
          kind={kind}
          value={value}
          isCorrect={value === correctValue}
          modality={modality}
          targetRef={targetRef}
          disabled={disabled}
          reduceMotion={reduceMotion}
          onChoose={(v) => {
            if (chosen.current) return;
            chosen.current = true;
            onChoose(v);
          }}
        />
      ))}
    </View>
  );
}

function Piece({
  kind,
  value,
  isCorrect,
  modality,
  targetRef,
  disabled,
  reduceMotion,
  onChoose,
}: {
  kind: PieceKind;
  value: string | number;
  isCorrect: boolean;
  modality: "tap" | "drag_drop";
  targetRef: React.RefObject<View | null>;
  disabled: boolean;
  reduceMotion: boolean;
  onChoose: (value: string | number) => void;
}) {
  const self = useRef<View>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  // An envelope goes in through the slot; a block stays on the tag.
  const vanishes = kind === "envelope";
  const target = useRef<Rect4 | null>(null);
  const home = useRef<Rect4 | null>(null);
  const busy = useRef(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  /** Offset (from this piece's home spot) that puts its centre on the target's centre. */
  function offsetToTarget(): { x: number; y: number } | null {
    const t = target.current;
    const h = home.current;
    if (!t || !h) return null;
    return { x: t.x + t.width / 2 - (h.x + h.width / 2), y: t.y + t.height / 2 - (h.y + h.height / 2) };
  }

  function land(done: () => void) {
    const to = offsetToTarget();
    if (!to || reduceMotion) {
      if (to) pan.setValue(to);
      scale.setValue(0.8);
      if (vanishes) opacity.setValue(0);
      return done();
    }
    Animated.sequence([
      Animated.parallel([
        Animated.timing(pan, { toValue: to, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(scale, { toValue: vanishes ? 0.55 : 0.8, duration: 380, useNativeDriver: false }),
      ]),
      vanishes
        ? Animated.parallel([
            Animated.timing(pan, { toValue: { x: to.x, y: to.y + 18 }, duration: 220, useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: false }),
          ])
        : Animated.delay(0),
    ]).start(() => done());
  }

  function goHome(done?: () => void) {
    const wob = reduceMotion
      ? Animated.delay(0)
      : Animated.sequence([
          Animated.timing(wobble, { toValue: 1, duration: 80, useNativeDriver: false }),
          Animated.timing(wobble, { toValue: -1, duration: 120, useNativeDriver: false }),
          Animated.timing(wobble, { toValue: 0, duration: 80, useNativeDriver: false }),
        ]);
    Animated.parallel([
      wob,
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 7 }),
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start(() => done?.());
  }

  async function refresh() {
    [target.current, home.current] = await Promise.all([measure(targetRef.current), measure(self.current)]);
  }

  async function handleTap() {
    if (disabledRef.current || busy.current) return;
    busy.current = true;
    await refresh();
    if (isCorrect) {
      land(() => onChoose(value));
    } else {
      onChoose(value);
      goHome(() => (busy.current = false));
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current && !busy.current,
      onPanResponderGrant: () => {
        refresh();
        scale.setValue(1.08);
      },
      // The screen may scroll on short phones — never let it take over a drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_evt, g) => {
        const t = target.current;
        const pad = 24; // forgiving edges for small hands
        const inside = t && g.moveX >= t.x - pad && g.moveX <= t.x + t.width + pad && g.moveY >= t.y - pad && g.moveY <= t.y + t.height + pad;
        if (!inside) {
          goHome();
          return;
        }
        busy.current = true;
        if (isCorrect) {
          land(() => onChoose(value));
        } else {
          onChoose(value);
          goHome(() => (busy.current = false));
        }
      },
    })
  ).current;

  const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: ["-8deg", "8deg"] });
  const body = kind === "block" ? <NumberBlock value={value} /> : <Envelope letter={String(value)} />;
  const transform = [...pan.getTranslateTransform(), { scale }, { rotate }];
  const moving = { transform, opacity };

  if (modality === "drag_drop") {
    return (
      <Animated.View
        ref={self}
        {...panResponder.panHandlers}
        style={[styles.piece, moving]}
        accessibilityRole="button"
        accessibilityLabel={`${kind === "block" ? "Number" : "Letter"} ${value}`}
      >
        {body}
      </Animated.View>
    );
  }
  return (
    <Animated.View ref={self} style={[styles.piece, moving]}>
      <Pressable onPress={handleTap} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${kind === "block" ? "Number" : "Letter"} ${value}`}>
        {body}
      </Pressable>
    </Animated.View>
  );
}

/** A chunky wooden toy block with its number carved in. */
export function NumberBlock({ value, size = 84 }: { value: string | number; size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 84 84" style={StyleSheet.absoluteFill}>
        <Rect x={2} y={6} width={80} height={76} rx={14} fill="#C9954F" />
        <Rect x={2} y={2} width={80} height={74} rx={14} fill="#EBC486" />
        <Path d="M12 10 H60" stroke="#F6DDB0" strokeWidth={5} strokeLinecap="round" />
        <Path d="M10 66 Q42 72 74 64" stroke="#D9AC67" strokeWidth={2} fill="none" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre, { paddingBottom: size * 0.06 }]}>
        <Text style={[styles.blockText, { fontSize: size * 0.52 }]}>{value}</Text>
      </View>
    </View>
  );
}

/** A letter in an envelope, with a little stamp. */
export function Envelope({ letter, width = 104 }: { letter: string; width?: number }) {
  const height = width * 0.7;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 104 73" style={StyleSheet.absoluteFill}>
        <Rect x={2} y={4} width={100} height={67} rx={8} fill="#D6DDE8" />
        <Rect x={2} y={2} width={100} height={66} rx={8} fill="#FFFFFF" stroke="#D6DDE8" strokeWidth={2} />
        <Path d="M4 6 L52 38 L100 6" stroke="#D6DDE8" strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        <Rect x={80} y={10} width={15} height={17} rx={2} fill="#8FD0FA" stroke="#5B8DEF" strokeWidth={1.5} strokeDasharray="2 2" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre, { paddingTop: height * 0.22 }]}>
        <Text style={[styles.envelopeText, { fontSize: height * 0.5 }]}>{letter}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 },
  piece: { zIndex: 2 },
  centre: { alignItems: "center", justifyContent: "center" },
  blockText: { color: "#5A3E1B", fontFamily: childFonts.bold },
  envelopeText: { color: "#1D2433", fontFamily: childFonts.bold },
});
