/**
 * A visual waiting timer (like the Time Timer used in autism classrooms):
 * a coloured disc that shrinks as time passes, so "wait five minutes" is
 * something the child can see, not an abstract number. The buddy gives a
 * warning before the end ("one more minute") so the change never comes as
 * a surprise.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { haptic, playSound } from "../design";
import { childFonts } from "../shared/theme";

const CHOICES = [1, 2, 5, 10];
const R = 100;

/** A pie wedge from 12 o'clock clockwise, covering `fraction` of the circle. */
function wedge(fraction: number): string {
  if (fraction <= 0) return "";
  if (fraction >= 0.9999) return `M 110 10 A ${R} ${R} 0 1 1 109.99 10 Z`;
  const angle = fraction * 2 * Math.PI;
  const x = 110 + R * Math.sin(angle);
  const y = 110 - R * Math.cos(angle);
  return `M 110 110 L 110 10 A ${R} ${R} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
}

export function WaitTimer({ onWarn, onFinish }: { onWarn: (text: string) => void; onFinish: () => void }) {
  const [total, setTotal] = useState<number | null>(null); // seconds
  const [left, setLeft] = useState(0);
  const warned = useRef(false);

  useEffect(() => {
    if (total === null) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [total]);

  useEffect(() => {
    if (total === null) return;
    if (left === 60 && total > 60 && !warned.current) {
      warned.current = true;
      onWarn("One more minute.");
    }
    if (left === 0) {
      haptic("success");
      playSound("celebrate");
      setTotal(null);
      onFinish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  function start(minutes: number) {
    haptic("select");
    warned.current = false;
    setTotal(minutes * 60);
    setLeft(minutes * 60);
  }

  if (total === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>How long do we wait?</Text>
        <View style={styles.choices}>
          {CHOICES.map((m) => (
            <Pressable key={m} onPress={() => start(m)} accessibilityRole="button" accessibilityLabel={`${m} minute${m > 1 ? "s" : ""}`} style={styles.choice}>
              <Text style={styles.choiceNumber}>{m}</Text>
              <Text style={styles.choiceUnit}>min</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  const minutes = Math.ceil(left / 60);
  return (
    <View style={styles.center}>
      <Svg width={240} height={240} viewBox="0 0 220 220" accessibilityLabel={`${minutes} minute${minutes > 1 ? "s" : ""} left`}>
        <Circle cx={110} cy={110} r={R + 6} fill="#FFFFFF" stroke="#D5DDE8" strokeWidth={3} />
        <Path d={wedge(left / total)} fill="#5B8DEF" />
        <Circle cx={110} cy={110} r={10} fill="#1D2433" />
      </Svg>
      <Text style={styles.left}>{left >= 60 ? `${minutes} minute${minutes > 1 ? "s" : ""} left` : `${left} seconds left`}</Text>
      <Pressable onPress={() => setTotal(null)} accessibilityRole="button" accessibilityLabel="Stop the timer" style={styles.stop}>
        <Ionicons name="stop-circle" size={26} color="#5B6475" />
        <Text style={styles.stopText}>Stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", padding: 24, gap: 18 },
  title: { fontFamily: childFonts.bold, fontSize: 26, color: "#1D2433", textAlign: "center" },
  choices: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
  choice: { width: 104, height: 104, borderRadius: 52, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#5B8DEF" },
  choiceNumber: { fontFamily: childFonts.bold, fontSize: 36, color: "#1D2433", lineHeight: 40 },
  choiceUnit: { fontFamily: childFonts.regular, fontSize: 15, color: "#5B6475" },
  left: { fontFamily: childFonts.bold, fontSize: 26, color: "#1D2433" },
  stop: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 56, paddingHorizontal: 20, borderRadius: 28, backgroundColor: "#E4EAF2" },
  stopText: { fontFamily: childFonts.bold, fontSize: 18, color: "#5B6475" },
});
