/**
 * "My day" — a visual schedule with a First-Then board on top, like
 * Choiceworks. The parent sets the steps (profile → My day); the child
 * sees what's happening now and what comes next, and ticks each step off.
 * Knowing what comes next is one of the most effective supports for
 * autistic children, because surprises are what cause the hardest moments.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { haptic, playSound } from "../design";
import { ScheduleStep } from "../shared/api";
import { useScheduleDone } from "../shared/deviceLists";
import { childFonts } from "../shared/theme";

export function MyDay({
  childId,
  childName,
  steps,
  onStepDone,
}: {
  childId: string;
  childName?: string;
  steps: ScheduleStep[];
  onStepDone: (step: ScheduleStep, next: ScheduleStep | undefined) => void;
}) {
  const [done, setDone] = useScheduleDone(childId);
  const nowIndex = steps.findIndex((s) => !done.includes(s.id));
  const now = nowIndex >= 0 ? steps[nowIndex] : undefined;
  const then = nowIndex >= 0 ? steps[nowIndex + 1] : undefined;

  if (!steps.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="calendar-outline" size={56} color="#9AA3B2" />
        <Text style={styles.emptyText}>No plan for today yet.</Text>
        <Text style={styles.emptyHint}>A grown-up can add one in {childName ? `${childName}'s` : "the"} profile.</Text>
      </View>
    );
  }

  function finish() {
    if (!now) return;
    haptic("success");
    playSound("success");
    setDone([...done, now.id]);
    onStepDone(now, then);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {now ? (
        <View style={styles.firstThen}>
          <Card title="First" step={now} highlight />
          <Ionicons name="arrow-forward" size={32} color="#9AA3B2" style={styles.arrow} />
          {then ? <Card title="Then" step={then} /> : <View style={styles.cardSpacer} />}
        </View>
      ) : (
        <View style={styles.allDone}>
          <Ionicons name="star" size={56} color="#F5B83D" />
          <Text style={styles.allDoneText}>All done for today!</Text>
        </View>
      )}
      {now && (
        <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel={`Finished ${now.label}`} style={styles.doneButton}>
          <Ionicons name="checkmark-circle" size={30} color="#FFFFFF" />
          <Text style={styles.doneText}>Finished!</Text>
        </Pressable>
      )}

      <View style={styles.list}>
        {steps.map((s, i) => {
          const isDone = done.includes(s.id);
          const isNow = i === nowIndex;
          return (
            <View key={s.id} style={[styles.row, isNow && styles.rowNow, isDone && styles.rowDone]}>
              <View style={[styles.rowIcon, isNow && { backgroundColor: "#0071E3" }]}>
                <Ionicons name={s.icon} size={26} color={isNow ? "#FFFFFF" : "#1D2433"} />
              </View>
              <Text style={[styles.rowText, isDone && styles.rowTextDone]}>{s.label}</Text>
              {isDone && <Ionicons name="checkmark-circle" size={28} color="#248A3D" />}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Card({ title, step, highlight }: { title: string; step: ScheduleStep; highlight?: boolean }) {
  return (
    <View style={[styles.card, highlight && styles.cardNow]} accessibilityLabel={`${title}: ${step.label}`}>
      <Text style={[styles.cardTitle, highlight && { color: "#0071E3" }]}>{title}</Text>
      <Ionicons name={step.icon} size={56} color="#1D2433" />
      <Text style={styles.cardLabel} numberOfLines={2}>
        {step.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, alignItems: "center" },
  firstThen: { flexDirection: "row", alignItems: "stretch", gap: 12, marginBottom: 16 },
  arrow: { alignSelf: "center" },
  card: {
    width: 150,
    minHeight: 180,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
    borderWidth: 3,
    borderColor: "transparent",
  },
  cardNow: { borderColor: "#0071E3" },
  cardSpacer: { width: 150 },
  cardTitle: { fontFamily: childFonts.bold, fontSize: 18, color: "#5B6475", textTransform: "uppercase", letterSpacing: 1 },
  cardLabel: { fontFamily: childFonts.bold, fontSize: 20, color: "#1D2433", textAlign: "center" },
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 28,
    borderRadius: 32,
    backgroundColor: "#248A3D",
    marginBottom: 24,
  },
  doneText: { fontFamily: childFonts.bold, fontSize: 22, color: "#FFFFFF" },
  allDone: { alignItems: "center", gap: 8, marginVertical: 24 },
  allDoneText: { fontFamily: childFonts.bold, fontSize: 26, color: "#1D2433" },
  list: { width: "100%", maxWidth: 520, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 10 },
  rowNow: { borderWidth: 2, borderColor: "#0071E3" },
  rowDone: { opacity: 0.55 },
  rowIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#EEF3F9", alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontFamily: childFonts.bold, fontSize: 20, color: "#1D2433" },
  rowTextDone: { textDecorationLine: "line-through" },
  empty: { alignItems: "center", padding: 40, gap: 10 },
  emptyText: { fontFamily: childFonts.bold, fontSize: 22, color: "#1D2433" },
  emptyHint: { fontFamily: childFonts.regular, fontSize: 17, color: "#5B6475", textAlign: "center" },
});
