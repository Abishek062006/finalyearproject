/**
 * Counting, as it happens at a real table: things sit in a woven basket,
 * the child touches each one to count it ("one, two, three…" — each gets its
 * number and the buddy says it aloud), then puts the matching number block on
 * the basket's tag. Level 3 tips the things in at random instead of in a
 * tidy row, which is what makes counting genuinely harder.
 */
import React, { useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { childFonts, ThemeCode } from "../../shared/theme";
import { ThemeObject } from "./ThemeObject";

const VIEW_W = 400;
const VIEW_H = 200;

/** Small deterministic PRNG so a layout never reshuffles on re-render. */
function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

type Spot = { cx: number; cy: number; rotate: number };

/** Where each thing sits, in viewBox units. Narrow screens use two rows so every thing stays big enough to touch. */
function layout(count: number, scattered: boolean, twoRows: boolean, key: string): Spot[] {
  const rand = seeded(key);
  const rows = twoRows && count > 3 ? [Math.ceil(count / 2), Math.floor(count / 2)] : [count];
  const rowY = rows.length === 2 ? [44, 96] : [70];
  const spots: Spot[] = [];
  rows.forEach((n, r) => {
    const left = rows.length === 2 && r === 1 && n < rows[0] ? 120 : 78;
    const right = VIEW_W - left;
    for (let i = 0; i < n; i++) {
      const cx = n === 1 ? VIEW_W / 2 : left + (i * (right - left)) / (n - 1);
      if (!scattered) {
        spots.push({ cx, cy: rowY[r], rotate: 0 });
        continue;
      }
      // Tipped in: nudged off the row, each at its own angle — no tidy line to lean on.
      const lift = rows.length === 1 ? (rand() < 0.5 ? -14 : 12) : (rand() - 0.5) * 14;
      spots.push({ cx: cx + (rand() - 0.5) * 22, cy: rowY[r] + lift, rotate: (rand() - 0.5) * 40 });
    }
  });
  return spots;
}

export function BasketScene({
  theme,
  count,
  level,
  itemKey,
  promptText,
  onCount,
  targetRef,
}: {
  theme: ThemeCode;
  count: number;
  level: number;
  itemKey: string;
  promptText: string;
  onCount: (n: number) => void;
  targetRef: React.RefObject<View | null>;
}) {
  const [width, setWidth] = useState(0);
  const [counted, setCounted] = useState<number[]>([]); // object index -> in tap order
  const scattered = level >= 3;
  const twoRows = width > 0 && width < 420;
  const spots = useMemo(() => layout(count, scattered, twoRows, itemKey), [count, scattered, twoRows, itemKey]);

  const k = width / VIEW_W;
  const height = VIEW_H * k;
  const size = Math.min(width * (twoRows ? 0.21 : scattered ? 0.16 : 0.19), 92);
  const tag = Math.max(56, Math.min(84, width * 0.2));

  // A ref, not just state: two quick taps in one frame must both count.
  const countedRef = useRef<number[]>([]);
  function tap(i: number) {
    if (countedRef.current.includes(i)) return;
    countedRef.current = [...countedRef.current, i];
    setCounted(countedRef.current);
    onCount(countedRef.current.length);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{promptText}</Text>
      <View style={styles.stage} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <View style={{ width, height: height * 0.7 + tag + 8 }}>
            {/* Drawn under the things, so every one of them stays fully visible for counting. */}
            <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={StyleSheet.absoluteFill}>
              <Path d="M62 92 C62 -12 338 -12 338 92" stroke="#B7813F" strokeWidth={14} fill="none" strokeLinecap="round" />
              <Ellipse cx={200} cy={92} rx={170} ry={26} fill="#8C5A26" />
<Path d="M30 96 Q200 128 370 96 L346 182 Q200 206 54 182 Z" fill="#D19A55" />
              <Path d="M42 124 Q200 152 358 124 M50 152 Q200 180 350 152" stroke="#B7813F" strokeWidth={5} fill="none" />
              {[90, 130, 170, 210, 250, 290].map((x) => (
                <Path key={x} d={`M${x + (x - 200) * 0.06} ${112 + Math.abs(x - 200) * -0.04} L${x} 190`} stroke="#C08845" strokeWidth={4} opacity={0.6} />
              ))}
              <Path d="M30 96 Q200 128 370 96" stroke="#E8B874" strokeWidth={12} strokeLinecap="round" fill="none" />
                        </Svg>

            {spots.map((s, i) => {
              const order = counted.indexOf(i);
              return (
                <Pressable
                  key={i}
                  onPress={() => tap(i)}
                  accessibilityRole="button"
                  accessibilityLabel={order >= 0 ? `Counted ${order + 1}` : "Count me"}
                  style={[
                    styles.thing,
                    { left: s.cx * k - size / 2, top: s.cy * k - size / 2, width: size, height: size, transform: [{ rotate: `${s.rotate}deg` }] },
                  ]}
                >
                  <ThemeObject theme={theme} size={size} />
                  {order >= 0 && (
                    <View style={[styles.badge, { transform: [{ rotate: `${-s.rotate}deg` }] }]}>
                      <Text style={styles.badgeText}>{order + 1}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}

            {/* The tag the number block goes on. */}
            <View style={[styles.tagString, { left: width * 0.84, top: height * 0.56 }]} />
            <View
              ref={targetRef}
              style={[styles.tag, { width: tag, height: tag, left: width * 0.84 - tag / 2, top: height * 0.7 }]}
              accessibilityLabel="Put the number here"
            >
              <Text style={styles.tagText}>?</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 10,
    paddingBottom: 8,
    marginBottom: 20,
    shadowColor: "rgba(29,36,51,0.08)",
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  prompt: { fontSize: 26, color: "#1D2433", fontFamily: childFonts.bold, textAlign: "center", marginBottom: 8 },
  stage: { width: "100%", maxWidth: 520, alignSelf: "center" },
  thing: { position: "absolute", alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#0071E3",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontFamily: childFonts.bold, fontSize: 16 },
  tagString: { position: "absolute", width: 2, height: 30, backgroundColor: "#8C5A26" },
  tag: {
    position: "absolute",
    borderRadius: 16,
    backgroundColor: "#FFFDF7",
    borderWidth: 3,
    borderColor: "#C9B79A",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-5deg" }],
  },
  tagText: { fontSize: 36, color: "#C9B79A", fontFamily: childFonts.bold },
});
