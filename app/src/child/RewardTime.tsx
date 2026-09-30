/**
 * The "then" of the token board: a short, calm play break with the child's
 * favourite thing. Bubbles holding their interest photo float up to be
 * popped. A bar shows play time running out, so the return to learning is
 * something the child can see coming rather than a surprise.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { haptic, playSound } from "../design";
import { childFonts, ThemeCode } from "../shared/theme";
import { ThemeObject } from "./scenes/ThemeObject";

const PLAY_MS = 20000;
const BUBBLES = 6;
const BUBBLE = 92;
const AREA_H = 320;

export function RewardTime({
  rewardUri,
  theme,
  reduceMotion,
  onPop,
  onDone,
}: {
  rewardUri: string | null;
  theme: ThemeCode;
  reduceMotion: boolean;
  onPop: (count: number) => void;
  onDone: () => void;
}) {
  const [width, setWidth] = useState(0);
  const timer = useRef(new Animated.Value(1)).current;
  const pops = useRef(0);

  useEffect(() => {
    const t = Animated.timing(timer, { toValue: 0, duration: PLAY_MS, easing: Easing.linear, useNativeDriver: false });
    t.start();
    const done = setTimeout(onDone, PLAY_MS);
    return () => {
      t.stop();
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Play time!</Text>
      <View style={styles.area} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 &&
          Array.from({ length: BUBBLES }, (_, i) => (
            <Bubble
              key={i}
              index={i}
              areaWidth={width}
              reduceMotion={reduceMotion}
              content={rewardUri ? <Image source={{ uri: rewardUri }} style={styles.photo} /> : <ThemeObject theme={theme} size={BUBBLE * 0.7} />}
              onPop={() => {
                pops.current += 1;
                playSound("pop");
                haptic("drop");
                onPop(pops.current);
              }}
            />
          ))}
      </View>
      <View style={styles.timerTrack} accessibilityLabel="Play time left">
        <Animated.View style={[styles.timerFill, { width: timer.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
      </View>
    </View>
  );
}

function Bubble({
  index,
  areaWidth,
  reduceMotion,
  content,
  onPop,
}: {
  index: number;
  areaWidth: number;
  reduceMotion: boolean;
  content: React.ReactNode;
  onPop: () => void;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [popped, setPopped] = useState(false);

  const cols = 3;
  const colW = areaWidth / cols;
  const x = (index % cols) * colW + (colW - BUBBLE) / 2 + (index % 2 ? 10 : -10);
  const restY = index < cols ? 24 : AREA_H - BUBBLE - 24;

  const duration = 7000 + (index % 3) * 1400;
  // Float from `from` (0 = bottom) to the top, then start again from the bottom.
  const floatUp = (from: number) => {
    rise.setValue(from);
    Animated.timing(rise, { toValue: 1, duration: duration * (1 - from), easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (finished) floatUp(0);
    });
  };

  useEffect(() => {
    if (reduceMotion) return;
    floatUp(((index * 0.37) % 1) * 0.9); // staggered, not a wall of bubbles
    return () => rise.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reduceMotion]);

  function handlePop() {
    if (popped) return;
    setPopped(true);
    onPop();
    Animated.timing(pop, { toValue: 0, duration: 160, useNativeDriver: false }).start(() => {
      setTimeout(() => {
        if (!reduceMotion) floatUp(0);
        pop.setValue(1);
        setPopped(false);
      }, 900);
    });
  }

  const top = reduceMotion ? restY : rise.interpolate({ inputRange: [0, 1], outputRange: [AREA_H, -BUBBLE] });
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [1.35, 1] });

  return (
    <Animated.View style={[styles.bubbleWrap, { left: x, top, opacity: pop, transform: [{ scale }] }]}>
      <Pressable onPress={handlePop} accessibilityRole="button" accessibilityLabel="Pop the bubble" style={styles.bubble}>
        {content}
        <View style={styles.shine} />
      </Pressable>
    </Animated.View>
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
  title: { fontSize: 28, color: "#1D2433", fontFamily: childFonts.bold, textAlign: "center" },
  area: { height: AREA_H, overflow: "hidden", marginVertical: 12 },
  bubbleWrap: { position: "absolute", width: BUBBLE, height: BUBBLE },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCEAFB",
    borderWidth: 3,
    borderColor: "rgba(127,200,248,0.9)",
  },
  photo: { width: BUBBLE, height: BUBBLE, opacity: 0.92 },
  shine: { position: "absolute", top: 12, left: 16, width: 22, height: 12, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.75)", transform: [{ rotate: "-30deg" }] },
  timerTrack: { height: 10, borderRadius: 5, backgroundColor: "#E4EAF2", overflow: "hidden" },
  timerFill: { height: 10, borderRadius: 5, backgroundColor: "#7BC47F" },
});
