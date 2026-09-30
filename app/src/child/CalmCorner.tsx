/**
 * The calm corner — where "Break" goes. Two things, both on the child's own
 * terms:
 *
 * 1. Breathe with the buddy: a soft circle slowly grows ("breathe in") and
 *    shrinks ("breathe out") around the child's friend, 4 seconds each way.
 * 2. "How do I feel?": four colour-coded feelings, the way many autism
 *    classrooms teach them (calm / sad or tired / worried / angry). The
 *    choice is sent to the safety layer — an upset answer makes the next
 *    lessons gentler — and the buddy answers kindly, never "fixing" the
 *    feeling.
 *
 * The child leaves when they choose to ("I'm ready"); nothing times out.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Buddy } from "../companion/Buddy";
import { BuddyController } from "../companion/useBuddy";
import { haptic } from "../design";
import { api, Feeling } from "../shared/api";
import { childFonts } from "../shared/theme";

const BREATH_MS = 4000;

const FEELINGS: { feeling: Feeling; label: string; face: string; mouth: string; reply: string }[] = [
  { feeling: "green", label: "Calm", face: "#8ED18B", mouth: "M13 24 Q20 30 27 24", reply: "You feel calm. That's lovely." },
  { feeling: "blue", label: "Sad or tired", face: "#8DB8EE", mouth: "M13 28 Q20 22 27 28", reply: "It's okay to feel sad or tired. Let's rest together." },
  { feeling: "yellow", label: "Worried", face: "#F4D56B", mouth: "M13 26 Q16.5 23 20 26 Q23.5 29 27 26", reply: "It's okay to feel worried. I'm right here with you." },
  { feeling: "red", label: "Angry", face: "#EE9A90", mouth: "M13 27 L27 27", reply: "It's okay to feel angry. Let's take big breaths together." },
];

export function CalmCorner({
  childId,
  sessionId,
  buddy,
  species,
  reduceMotion,
  onReady,
}: {
  childId: string;
  sessionId?: string | null;
  buddy: BuddyController;
  species?: string;
  reduceMotion: boolean;
  onReady: () => void;
}) {
  const breath = useRef(new Animated.Value(0)).current;
  const [inhaling, setInhaling] = useState(true);
  const [picked, setPicked] = useState<Feeling | null>(null);

  useEffect(() => {
    buddy.setMood("neutral");
    buddy.say("Let's take a break. Breathe with me.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    const cycle = (inhale: boolean) => {
      if (!alive) return;
      setInhaling(inhale);
      if (reduceMotion) {
        const t = setTimeout(() => cycle(!inhale), BREATH_MS);
        return () => clearTimeout(t);
      }
      Animated.timing(breath, { toValue: inhale ? 1 : 0, duration: BREATH_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: false }).start(({ finished }) => {
        if (finished) cycle(!inhale);
      });
    };
    cycle(true);
    return () => {
      alive = false;
      breath.stopAnimation();
    };
  }, [breath, reduceMotion]);

  function pick(f: (typeof FEELINGS)[number]) {
    haptic("select");
    setPicked(f.feeling);
    buddy.setMood(f.feeling === "green" ? "happy" : "encouraging");
    buddy.say(f.reply);
    api.sendSignal(childId, "feeling", { feeling: f.feeling }, sessionId);
  }

  const glow = breath.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.12] });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.breathArea}>
        <Animated.View style={[styles.glow, { transform: [{ scale: reduceMotion ? 1 : glow }] }]} />
        <Buddy buddy={buddy} size={150} species={species} />
      </View>
      <Text style={styles.breathText} accessibilityLiveRegion="polite">
        {inhaling ? "Breathe in…" : "Breathe out…"}
      </Text>

      <Text style={styles.question}>How do I feel?</Text>
      <View style={styles.feelings}>
        {FEELINGS.map((f) => (
          <Pressable
            key={f.feeling}
            onPress={() => pick(f)}
            accessibilityRole="button"
            accessibilityLabel={f.label}
            accessibilityState={{ selected: picked === f.feeling }}
            aria-selected={picked === f.feeling}
            style={[styles.feeling, picked === f.feeling && { borderColor: f.face, backgroundColor: "#FFFFFF" }]}
          >
            <Svg width={64} height={64} viewBox="0 0 40 40">
              <Circle cx={20} cy={20} r={18} fill={f.face} />
              <Circle cx={14} cy={16} r={2.2} fill="#1D2433" />
              <Circle cx={26} cy={16} r={2.2} fill="#1D2433" />
              {f.feeling === "red" && <Path d="M10 11 L17 13 M30 11 L23 13" stroke="#1D2433" strokeWidth={1.8} strokeLinecap="round" />}
              <Path d={f.mouth} stroke="#1D2433" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.feelingText}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={onReady} accessibilityRole="button" accessibilityLabel="I'm ready" style={styles.ready}>
        <Text style={styles.readyText}>I'm ready</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignItems: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  breathArea: { width: 280, height: 280, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "#CFE6F5" },
  breathText: { fontFamily: childFonts.bold, fontSize: 28, color: "#3C6E91", marginTop: 4, marginBottom: 28 },
  question: { fontFamily: childFonts.bold, fontSize: 24, color: "#1D2433", marginBottom: 14 },
  feelings: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginBottom: 28 },
  feeling: {
    width: 136,
    minHeight: 136,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: "transparent",
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    gap: 6,
  },
  feelingText: { fontFamily: childFonts.bold, fontSize: 17, color: "#1D2433", textAlign: "center" },
  ready: { minHeight: 72, paddingHorizontal: 40, borderRadius: 36, backgroundColor: "#248A3D", alignItems: "center", justifyContent: "center" },
  readyText: { fontFamily: childFonts.bold, fontSize: 24, color: "#FFFFFF" },
});
