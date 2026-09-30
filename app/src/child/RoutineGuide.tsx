/**
 * A routine as a real-life guide: at the sink or the wardrobe, one big step
 * at a time. The buddy reads each step, the child taps "Done!", and the
 * dots show how many are left — the same steps the ordering lesson teaches.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BuddyController } from "../companion/useBuddy";
import { haptic, playSound } from "../design";
import { childFonts } from "../shared/theme";
import { Routine, ROUTINES } from "./routines";

export function RoutineGuide({ buddy }: { buddy: BuddyController }) {
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [step, setStep] = useState(0);
  const finished = routine !== null && step >= routine.steps.length;

  useEffect(() => {
    if (!routine) {
      buddy.say("Which one are we doing?");
      return;
    }
    if (finished) {
      buddy.gesture("celebrate");
      buddy.say(`All done! Great ${routine.label.toLowerCase()}!`, { mood: "excited" });
      return;
    }
    buddy.say(routine.steps[step].label, { mood: "encouraging" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine, step]);

  if (!routine) {
    return (
      <View style={styles.choices}>
        {ROUTINES.map((r) => (
          <Pressable
            key={r.code}
            onPress={() => {
              haptic("select");
              setStep(0);
              setRoutine(r);
            }}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            style={styles.choice}
          >
            <Text style={styles.choicePicture}>{r.picture}</Text>
            <Text style={styles.choiceText}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.guide}>
      <Text style={styles.routineTitle}>{routine.label}</Text>
      <View style={styles.dots} accessibilityLabel={`Step ${Math.min(step + 1, routine.steps.length)} of ${routine.steps.length}`}>
        {routine.steps.map((_, i) => (
          <View key={i} style={[styles.dot, i < step && styles.dotDone, i === step && styles.dotNow]} />
        ))}
      </View>

      {finished ? (
        <View style={styles.bigCard}>
          <Ionicons name="star" size={96} color="#F5B83D" />
          <Text style={styles.bigLabel}>All done!</Text>
        </View>
      ) : (
        <View style={styles.bigCard}>
          <Text style={styles.stepNumber}>Step {step + 1}</Text>
          <Text style={styles.bigPicture}>{routine.steps[step].picture}</Text>
          <Text style={styles.bigLabel}>{routine.steps[step].label}</Text>
        </View>
      )}

      {finished ? (
        <Pressable onPress={() => setRoutine(null)} accessibilityRole="button" accessibilityLabel="Choose another" style={[styles.action, { backgroundColor: "#3C6E91" }]}>
          <Text style={styles.actionText}>Another one</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            haptic("success");
            playSound(step + 1 >= routine.steps.length ? "celebrate" : "success");
            setStep((s) => s + 1);
          }}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={styles.action}
        >
          <Ionicons name="checkmark-circle" size={30} color="#FFFFFF" />
          <Text style={styles.actionText}>Done!</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, padding: 20 },
  choice: { width: 170, height: 150, borderRadius: 26, backgroundColor: "#DDEBF4", alignItems: "center", justifyContent: "center", gap: 8 },
  choicePicture: { fontSize: 56, lineHeight: 68 },
  bigPicture: { fontSize: 120, lineHeight: 140 },
  choiceText: { fontFamily: childFonts.bold, fontSize: 20, color: "#3C6E91", textAlign: "center" },
  guide: { alignItems: "center", padding: 20, paddingBottom: 40, gap: 16 },
  routineTitle: { fontFamily: childFonts.bold, fontSize: 18, color: "#5B6475", textTransform: "uppercase", letterSpacing: 1 },
  dots: { flexDirection: "row", gap: 10 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#D5DDE8" },
  dotDone: { backgroundColor: "#7CC26B" },
  dotNow: { backgroundColor: "#0071E3", transform: [{ scale: 1.25 }] },
  bigCard: { width: "100%", maxWidth: 420, minHeight: 280, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", padding: 20, gap: 12 },
  stepNumber: { fontFamily: childFonts.bold, fontSize: 18, color: "#0071E3" },
  bigLabel: { fontFamily: childFonts.bold, fontSize: 30, color: "#1D2433", textAlign: "center" },
  action: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 72, paddingHorizontal: 36, borderRadius: 36, backgroundColor: "#248A3D" },
  actionText: { fontFamily: childFonts.bold, fontSize: 24, color: "#FFFFFF" },
});
