/**
 * Recognising feelings: an empty picture frame on the wall, and the buddy
 * asks for one feeling ("Find the sad face!"). The child puts the matching
 * face in the frame — tapped or carried there, like every other scene.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { childFonts } from "../../shared/theme";

const FRAME_W = 150;
const FRAME_H = 170;

export function FeelingsScene({ promptText, targetRef }: { promptText: string; targetRef: React.RefObject<View | null> }) {
  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{promptText}</Text>
      <View style={styles.wall}>
        <View style={{ width: FRAME_W, height: FRAME_H }}>
          <Svg width={FRAME_W} height={FRAME_H} viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} style={StyleSheet.absoluteFill}>
            <Rect x={4} y={8} width={142} height={158} rx={10} fill="#B07A43" />
            <Rect x={4} y={4} width={142} height={158} rx={10} fill="#D9A566" />
            <Rect x={16} y={16} width={118} height={134} rx={6} fill="#FFFDF7" stroke="#C9B79A" strokeWidth={2.5} strokeDasharray="7 6" />
          </Svg>
          <View ref={targetRef} style={styles.inside} accessibilityLabel="Put the face in the frame" />
        </View>
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
  prompt: { fontSize: 26, color: "#1D2433", fontFamily: childFonts.bold, textAlign: "center", marginBottom: 14 },
  wall: { alignItems: "center", paddingVertical: 8, backgroundColor: "#F4EFE6", borderRadius: 20 },
  inside: { position: "absolute", left: 16, top: 16, width: 118, height: 134 },
});
