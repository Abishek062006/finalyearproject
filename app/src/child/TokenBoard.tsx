/**
 * A First-Then token board, the everyday tool of autism classrooms: each
 * finished activity earns a star, and a full row of stars earns the "then" —
 * the child's own favourite thing (their chosen interest photo). The child
 * can always see how many are left before play time, which makes the
 * session's end predictable instead of arbitrary.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ThemeCode } from "../shared/theme";
import { ThemeObject } from "./scenes/ThemeObject";

export const TOKENS_FOR_REWARD = 5;

const STAR = "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z";

export function TokenBoard({
  earned,
  rewardUri,
  theme,
  reduceMotion,
}: {
  earned: number;
  rewardUri: string | null;
  theme: ThemeCode;
  reduceMotion: boolean;
}) {
  return (
    <View style={styles.board} accessibilityLabel={`${earned} of ${TOKENS_FOR_REWARD} stars, then play time`}>
      {Array.from({ length: TOKENS_FOR_REWARD }, (_, i) => (
        <Star key={i} filled={i < earned} fresh={i === earned - 1} reduceMotion={reduceMotion} />
      ))}
      <Svg width={16} height={16} viewBox="0 0 16 16" style={styles.arrow}>
        <Path d="M5 3l5 5-5 5" stroke="#9AA3B2" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={styles.reward}>
        {rewardUri ? <Image source={{ uri: rewardUri }} style={styles.rewardImage} /> : <ThemeObject theme={theme} size={26} />}
      </View>
    </View>
  );
}

function Star({ filled, fresh, reduceMotion }: { filled: boolean; fresh: boolean; reduceMotion: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!filled || !fresh || reduceMotion) return;
    scale.setValue(0.3);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: false }).start();
  }, [filled, fresh, reduceMotion, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d={STAR} fill={filled ? "#F5B83D" : "none"} stroke={filled ? "#E0A020" : "#C9D2E0"} strokeWidth={1.6} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    shadowColor: "rgba(29,36,51,0.08)",
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  arrow: { marginHorizontal: 2 },
  reward: { width: 32, height: 32, borderRadius: 16, overflow: "hidden", backgroundColor: "#DCEAFB", alignItems: "center", justifyContent: "center" },
  rewardImage: { width: 32, height: 32 },
});
