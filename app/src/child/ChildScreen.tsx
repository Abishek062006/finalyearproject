/**
 * The child learning environment (README §30, §2C). This is Phase 2's
 * vertical slice: bootstrap -> fetch an ActivitySpec -> render whatever it
 * says (theme, modality, items) -> report answers back -> repeat.
 *
 * The screen makes NO adaptation decisions itself — every varying field
 * (theme, modality, difficulty, method) comes from the backend's
 * DecisionEngine (docs/ARCHITECTURE.md §6). This file only renders it.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { GuideBubble } from "./GuideBubble";
import { CountingScene } from "./CountingScene";
import { TapAnswer } from "./TapAnswer";
import { DragDropAnswer } from "./DragDropAnswer";
import { api, Activity, Child, Session } from "../shared/api";
import { colors, spacing, ThemeCode } from "../shared/theme";

type Phase = "loading" | "playing" | "feedback" | "error";

export function ChildScreen() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [child, setChild] = useState<Child | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const responseStartedAt = useRef<number>(Date.now());

  const bootstrap = useCallback(async () => {
    try {
      setPhase("loading");
      const c = await api.quickstartChild();
      const s = await api.startSession(c.id);
      const a = await api.nextActivity(s.id);
      setChild(c);
      setSession(s);
      setActivity(a);
      setItemIndex(0);
      responseStartedAt.current = Date.now();
      setPhase("playing");
    } catch (err) {
      setErrorMessage(
        `${err instanceof Error ? err.message : String(err)}\n\nIs the backend running?\n` +
          "cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000"
      );
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  async function handleChoose(value: number) {
    if (!activity || !session || phase !== "playing") return;

    const item = activity.spec.items[itemIndex];
    const correct = value === item.answer.count;
    const responseTimeMs = Date.now() - responseStartedAt.current;

    setLastCorrect(correct);
    setPhase("feedback");

    await api.submitAnswer(activity.id, {
      item_id: item.id,
      correct,
      response_time_ms: responseTimeMs,
    });

    setTimeout(async () => {
      const isLastItemInSet = itemIndex + 1 >= activity.spec.items.length;
      if (!isLastItemInSet) {
        setItemIndex((i) => i + 1);
        responseStartedAt.current = Date.now();
        setPhase("playing");
        return;
      }
      try {
        const next = await api.nextActivity(session.id);
        setActivity(next);
        setItemIndex(0);
        setRoundsCompleted((r) => r + 1);
        responseStartedAt.current = Date.now();
        setPhase("playing");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    }, 1100);
  }

  if (phase === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Getting ready to play...</Text>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={bootstrap}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!activity) return null;
  const item = activity.spec.items[itemIndex];
  const theme = (activity.spec.theme as ThemeCode) ?? "dino";
  const choices = [item.answer.count, ...item.distractors];

  const guideText =
    phase === "feedback"
      ? lastCorrect
        ? "Great job! 🎉"
        : "Almost! Let's try another one."
      : "Let's play!";

  return (
    <View style={styles.container}>
      <GuideBubble theme={theme} text={guideText} />

      <CountingScene theme={theme} count={item.answer.count} />

      {activity.spec.modality === "drag_drop" ? (
        // key=item.id forces a clean remount per item, so the one-time
        // shuffle in DragDropAnswer can never re-run (and re-order tiles
        // under the child's finger) mid-gesture on an unrelated re-render.
        <DragDropAnswer key={item.id} choices={choices} onChoose={handleChoose} disabled={phase !== "playing"} />
      ) : (
        <TapAnswer key={item.id} choices={choices} onChoose={handleChoose} disabled={phase !== "playing"} />
      )}

      {/* Dev-only debug strip — shows the adaptive decisions being made.
          Remove before this becomes a child-facing build (docs/PLAN.md Phase 3+). */}
      <View style={styles.debugStrip}>
        <Text style={styles.debugText}>
          topic={activity.spec.topic_code} ({activity.spec.topic_reason}) · difficulty={activity.spec.difficulty} ·
          method={activity.spec.method} [{activity.spec.decision_types.teaching_method}] · modality=
          {activity.spec.modality} [{activity.spec.decision_types.modality}] · item {itemIndex + 1}/
          {activity.spec.items.length} · rounds={roundsCompleted}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: "center" },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  loadingText: { marginTop: spacing.md, fontSize: 18, color: colors.textSecondary },
  errorText: { color: colors.textPrimary, fontSize: 16, textAlign: "center", marginBottom: spacing.lg },
  retryButton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 20 },
  retryButtonText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  debugStrip: { position: "absolute", bottom: spacing.sm, left: spacing.md, right: spacing.md },
  debugText: { fontSize: 11, color: colors.textSecondary, textAlign: "center", fontFamily: "monospace" },
});
