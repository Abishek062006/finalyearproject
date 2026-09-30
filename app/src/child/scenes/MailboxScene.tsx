/**
 * Finding a letter, as a job with a purpose: post the envelope marked with
 * the letter the buddy asks for. The right envelope goes through the slot
 * and the mailbox's flag pops up.
 */
import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Ellipse, G, Path, Rect } from "react-native-svg";
import { childFonts } from "../../shared/theme";

const VIEW_W = 200;
const VIEW_H = 220;
// The slot, in viewBox units.
const SLOT = { x: 66, y: 66, w: 68, h: 12 };

export function MailboxScene({
  promptText,
  posted,
  targetRef,
}: {
  promptText: string;
  posted: boolean;
  targetRef: React.RefObject<View | null>;
}) {
  const { width: screenW } = useWindowDimensions();
  const w = Math.min(190, screenW * 0.42);
  const k = w / VIEW_W;
  const h = VIEW_H * k;

  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{promptText}</Text>
      <View style={{ width: w, height: h, alignSelf: "center" }}>
        <Svg width={w} height={h} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Ellipse cx={100} cy={208} rx={56} ry={8} fill="#D5DDE8" />
          <Rect x={91} y={112} width={18} height={96} rx={4} fill="#9AA3B2" />
          <G transform={posted ? "rotate(-90 164 94)" : undefined}>
            <Rect x={160} y={90} width={34} height={7} rx={3.5} fill="#7A8699" />
            <Rect x={184} y={74} width={20} height={16} rx={3} fill="#F2B544" />
          </G>
          <Path d="M36 116 L36 62 Q36 18 100 18 Q164 18 164 62 L164 116 Z" fill="#5B8DEF" />
          <Path d="M36 62 Q36 18 100 18 Q164 18 164 62" stroke="#7FA8F5" strokeWidth={6} fill="none" />
          <Rect x={50} y={92} width={100} height={16} rx={8} fill="#4A7BDF" />
          <Rect x={SLOT.x} y={SLOT.y} width={SLOT.w} height={SLOT.h} rx={6} fill="#1D2433" />
        </Svg>
        {/* A generous drop area around the slot for small hands. */}
        <View
          ref={targetRef}
          style={[styles.slotTarget, { left: (SLOT.x - 20) * k, top: (SLOT.y - 24) * k, width: (SLOT.w + 40) * k, height: (SLOT.h + 48) * k }]}
        />
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
  prompt: { fontSize: 26, color: "#1D2433", fontFamily: childFonts.bold, textAlign: "center", marginBottom: 12 },
  slotTarget: { position: "absolute", pointerEvents: "none" },
});
