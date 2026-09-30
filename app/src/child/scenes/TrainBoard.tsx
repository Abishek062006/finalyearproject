/**
 * Ordering numbers, as building a toy train: tap the carriages in order
 * (1, then 2, then 3…) and each one hooks on behind the engine. When the
 * train is complete it chugs away. Level 1 shows faint numbers in the empty
 * spaces as a hint; higher levels leave them blank.
 *
 * Teaching method (README's errorless vs try_then_correct), unchanged from
 * the old tile board: an "errorless" wrong tap just bounces and is never
 * recorded; "try_then_correct" records one miss against the carriage being
 * sought, then still waits for the right one.
 */
import React, { useMemo, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { childFonts } from "../../shared/theme";

const CARRIAGE_COLOURS = ["#7BC47F", "#F59E5B", "#5B8DEF", "#F2B544", "#B58DEF"];

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface TrainItem {
  id: string;
  value: number;
  position: number;
}

export function TrainBoard({
  items,
  method,
  level,
  promptText,
  reduceMotion,
  onItemAnswered,
  onAllDone,
  disabled,
}: {
  items: TrainItem[];
  method: "errorless" | "try_then_correct" | null;
  level: number;
  promptText: string;
  reduceMotion: boolean;
  onItemAnswered: (itemId: string, correct: boolean, responseTimeMs: number) => void;
  onAllDone: () => void;
  disabled: boolean;
}) {
  const [placed, setPlaced] = useState<string[]>([]);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const missRecorded = useRef<Set<string>>(new Set());
  const soughtSince = useRef(Date.now());
  const depart = useRef(new Animated.Value(0)).current;

  const inOrder = useMemo(() => [...items].sort((a, b) => a.position - b.position), [items]);
  // Depend on ids, not the array reference — see SceneChoices.
  const pieces = useMemo(() => shuffled(items), [items.map((i) => i.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const sought = inOrder[placed.length];

  const n = items.length;
  const car = width > 0 ? Math.min(78, (width - 8) / (n + 1.35) - 4) : 0;

  function tap(item: TrainItem) {
    if (disabled || placed.includes(item.id) || !sought) return;
    const rt = Date.now() - soughtSince.current;
    if (item.id === sought.id) {
      const next = [...placed, item.id];
      setPlaced(next);
      soughtSince.current = Date.now();
      onItemAnswered(item.id, true, rt);
      if (next.length === n) {
        const finish = () => setTimeout(onAllDone, 250);
        if (reduceMotion) return finish();
        Animated.timing(depart, { toValue: 1, duration: 1400, delay: 350, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(finish);
      }
      return;
    }
    setShakeId(item.id);
    setTimeout(() => setShakeId(null), 420);
    if (method === "try_then_correct" && !missRecorded.current.has(sought.id)) {
      missRecorded.current.add(sought.id);
      onItemAnswered(sought.id, false, rt);
    }
  }

  const translateX = depart.interpolate({ inputRange: [0, 1], outputRange: [0, width + 40] });

  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{promptText}</Text>
      <View style={styles.trackArea} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <>
            <Animated.View style={[styles.train, { transform: [{ translateX }] }]}>
              <Engine size={car * 1.3} />
              {inOrder.map((item) => {
                const on = placed.includes(item.id);
                return (
                  <View key={item.id} style={styles.link}>
                    <View style={styles.coupler} />
                    {on ? (
                      <Carriage value={item.value} colour={CARRIAGE_COLOURS[(item.value - 1) % 5]} size={car} />
                    ) : (
                      <View style={[styles.emptySlot, { width: car, height: car * 0.78 }]}>
                        {level <= 1 && <Text style={[styles.hint, { fontSize: car * 0.36 }]}>{item.value}</Text>}
                      </View>
                    )}
                  </View>
                );
              })}
            </Animated.View>
            <View style={styles.rail} />
          </>
        )}
      </View>

      <View style={styles.pieces}>
        {pieces.map((item) => {
          const on = placed.includes(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => tap(item)}
              disabled={disabled || on}
              accessibilityRole="button"
              accessibilityLabel={`Carriage ${item.value}`}
              style={[styles.piece, on && styles.pieceGone, shakeId === item.id && styles.pieceShake]}
            >
              <Carriage value={item.value} colour={CARRIAGE_COLOURS[(item.value - 1) % 5]} size={84} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Carriage({ value, colour, size }: { value: number; colour: string; size: number }) {
  return (
    <View style={{ width: size, height: size * 0.86 }}>
      <Svg width={size} height={size * 0.86} viewBox="0 0 100 86" style={StyleSheet.absoluteFill}>
        <Rect x={4} y={8} width={92} height={60} rx={12} fill={colour} />
        <Rect x={4} y={8} width={92} height={12} rx={6} fill="#FFFFFF" opacity={0.3} />
        <Rect x={10} y={62} width={80} height={8} rx={4} fill="#5B6475" />
        <Circle cx={28} cy={74} r={10} fill="#2E3440" />
        <Circle cx={28} cy={74} r={4} fill="#C9D2E0" />
        <Circle cx={72} cy={74} r={10} fill="#2E3440" />
        <Circle cx={72} cy={74} r={4} fill="#C9D2E0" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", paddingTop: size * 0.1 }]}>
        <Text style={[styles.carNumber, { fontSize: size * 0.44 }]}>{value}</Text>
      </View>
    </View>
  );
}

function Engine({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 100 80">
      <Rect x={66} y={6} width={13} height={22} rx={3} fill="#3F6FD1" />
      <Rect x={2} y={10} width={40} height={52} rx={8} fill="#5B8DEF" />
      <Rect x={9} y={18} width={26} height={18} rx={5} fill="#CFE8FB" />
      <Rect x={36} y={26} width={58} height={36} rx={14} fill="#3F6FD1" />
      <Circle cx={88} cy={44} r={11} fill="#F4F6FA" />
      <Circle cx={85} cy={41} r={2} fill="#1D2433" />
      <Circle cx={92} cy={41} r={2} fill="#1D2433" />
      <Path d="M84 47 Q88.5 50 93 47" stroke="#1D2433" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Circle cx={20} cy={68} r={10} fill="#2E3440" />
      <Circle cx={50} cy={68} r={10} fill="#2E3440" />
      <Circle cx={78} cy={70} r={8} fill="#2E3440" />
    </Svg>
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
  prompt: { fontSize: 26, color: "#1D2433", fontFamily: childFonts.bold, textAlign: "center", marginBottom: 12 },
  trackArea: { width: "100%", overflow: "hidden", paddingBottom: 6, marginBottom: 20 },
  train: { flexDirection: "row", alignItems: "flex-end" },
  link: { flexDirection: "row", alignItems: "flex-end" },
  coupler: { width: 6, height: 5, backgroundColor: "#5B6475", marginBottom: 14 },
  emptySlot: {
    borderRadius: 12,
    borderWidth: 2.5,
    borderStyle: "dashed",
    borderColor: "#C9D2E0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  hint: { color: "#C9D2E0", fontFamily: childFonts.bold },
  rail: { height: 5, borderRadius: 3, backgroundColor: "#9AA3B2", marginTop: 2 },
  carNumber: { color: "#FFFFFF", fontFamily: childFonts.bold },
  pieces: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
  piece: { borderRadius: 16, padding: 4 },
  pieceGone: { opacity: 0 },
  // Never red (README §31) — a soft grey nudge.
  pieceShake: { backgroundColor: "#E4EAF2", transform: [{ rotate: "-4deg" }] },
});
