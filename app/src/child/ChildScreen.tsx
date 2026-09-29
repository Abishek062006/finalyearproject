/**
 * The child learning environment (README §30, §2C). This is Phase 2's
 * vertical slice: bootstrap -> fetch an ActivitySpec -> render whatever it
 * says (theme, modality, items) -> report answers back -> repeat.
 *
 * The screen makes NO adaptation decisions itself — every varying field
 * (theme, modality, difficulty, method) comes from the backend's
 * DecisionEngine (docs/ARCHITECTURE.md §6). This file only renders it.
 *
 * Takes a real childId (docs/PLAN.md Phase 3: the parent creates and picks
 * the child; this screen no longer self-registers via /dev/quickstart —
 * that endpoint remains for backend testing/dev convenience only).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptic, ParentalGate, playSound, useSettings, useTheme } from "../design";
import { GuideBubble } from "./GuideBubble";
import { CountingScene } from "./CountingScene";
import { IdentifyScene } from "./IdentifyScene";
import { TapAnswer } from "./TapAnswer";
import { DragDropAnswer } from "./DragDropAnswer";
import { MatchingBoard } from "./MatchingBoard";
import { SequenceBoard } from "./SequenceBoard";
import { InterventionScreen } from "./InterventionScreen";
import { api, API_BASE, Activity, Session } from "../shared/api";
import { pendingCount } from "../shared/offlineQueue";
import { colors, spacing, THEME_ASSETS, ThemeCode, childFonts } from "../shared/theme";

type Phase = "loading" | "playing" | "feedback" | "error";

export function ChildScreen({ childId, onExit }: { childId: string; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [boardResolved, setBoardResolved] = useState(0); // "matching"/"sequencing" only — how many of the whole-board items are answered so far
  const responseStartedAt = useRef<number>(Date.now());
  const { colors: childColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showDecisionOverlay } = useSettings();

  const bootstrap = useCallback(async () => {
    try {
      setPhase("loading");
      const s = await api.startSession(childId);
      const a = await api.nextActivity(s.id);
      setSession(s);
      setActivity(a);
      setItemIndex(0);
      setBoardResolved(0);
      responseStartedAt.current = Date.now();
      setPhase("playing");
    } catch (err) {
      setErrorMessage(
        `${err instanceof Error ? err.message : String(err)}\n\nIs the backend running?\n` +
          "cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000"
      );
      setPhase("error");
    }
  }, [childId]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Shared by the last item of a normal (counting/letter_identify) activity,
  // an intervention finishing, and a whole board (matching/sequencing)
  // finishing — all three end the same way: fetch whatever the
  // DecisionEngine picks next.
  async function goToNextActivity() {
    if (!session) return;
    try {
      const next = await api.nextActivity(session.id);
      setActivity(next);
      setItemIndex(0);
      setBoardResolved(0);
      responseStartedAt.current = Date.now();
      setPhase("playing");
    } catch (err) {
      await showNextActivityError(err);
    }
  }

  // MatchingBoard/SequenceBoard resolve items in whatever order the child
  // taps them, not sequentially by itemIndex — each resolution is recorded
  // immediately, exactly like a single tap-choice answer.
  async function handleBoardItemAnswered(itemId: string, correct: boolean, responseTimeMs: number) {
    if (!activity) return;
    setBoardResolved((n) => n + 1);
    giveAnswerFeedback(correct, "board");
    await api.submitAnswerReliably(activity.id, { item_id: itemId, correct, response_time_ms: responseTimeMs });
  }

  async function handleBoardAllDone() {
    haptic("success");
    playSound("celebrate");
    setRoundsCompleted((r) => r + 1);
    await goToNextActivity();
  }

  async function handleChoose(value: string | number) {
    if (!activity || !session || phase !== "playing") return;

    const item = activity.spec.items[itemIndex];
    const answerValue = "label" in item.answer ? item.answer.label : "count" in item.answer ? item.answer.count : 0;
    const correct = value === answerValue;
    const responseTimeMs = Date.now() - responseStartedAt.current;

    setLastCorrect(correct);
    setPhase("feedback");
    giveAnswerFeedback(correct, "single");

    await api.submitAnswerReliably(activity.id, {
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
      setRoundsCompleted((r) => r + 1);
      await goToNextActivity();
    }, 1100);
  }

  // Never punitive: a wrong answer is a soft tap and a quiet low tone, never a buzzer (README §31).
  function giveAnswerFeedback(correct: boolean, kind: "single" | "board") {
    if (correct) {
      haptic(kind === "board" ? "drop" : "success");
      playSound(kind === "board" ? "pop" : "success");
    } else {
      haptic("gentleNudge");
      playSound("nudge");
    }
  }

  // Only reachable through the grown-ups gate (ParentalGate) — never a plain tap.
  async function finishForToday() {
    if (session) {
      try {
        await api.endSession(session.id);
      } catch {
        // Offline: nothing to lose here (endSession just stamps ended_at/
        // end_reason) — let the child leave either way rather than trap
        // them on this screen.
      }
    }
    onExit();
  }

  async function showNextActivityError(err: unknown) {
    // The answer that just finished this activity is safe either way — it
    // was queued locally if the network failed (offlineQueue.ts). Fetching
    // a NEW activity genuinely needs connectivity (DecisionEngine picks it
    // adaptively from that answer), so this is the one place offline play
    // can't continue transparently — say so plainly instead of a raw error.
    const queued = await pendingCount();
    setErrorMessage(
      queued > 0
        ? `You're offline. ${queued} answer${queued === 1 ? "" : "s"} saved and waiting to sync — reconnect and try again to keep playing.`
        : err instanceof Error
          ? err.message
          : String(err)
    );
    setPhase("error");
  }

  if (phase === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: childColors.background }]}>
        <ActivityIndicator size="large" color={childColors.tint} />
        <Text style={styles.loadingText}>Getting ready to play...</Text>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={[styles.center, { backgroundColor: childColors.background }]}>
        <View style={[styles.gateSlot, { top: insets.top + spacing.sm }]}>
          <ParentalGate onUnlock={onExit} />
        </View>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={bootstrap}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!activity) return null;

  const theme = (activity.spec.theme as ThemeCode) ?? "dino";
  // Whichever image is "who's talking" throughout this screen: the child's
  // own parent-chosen companion when they have one, the theme's own bundled
  // photo otherwise (docs/PLAN.md UX-overhaul Phase C). Never affects which
  // theme the actual lesson content (CountingScene's photo) uses.
  const avatarImageSource = activity.spec.companion_image_url
    ? { uri: `${API_BASE}${activity.spec.companion_image_url}` }
    : THEME_ASSETS[theme].image;
  const accentColor = THEME_ASSETS[theme].accent;

  if (activity.spec.is_intervention) {
    return (
      <InterventionScreen
        type={activity.spec.intervention_type!}
        guideName={activity.spec.guide_name}
        imageSource={avatarImageSource}
        onDone={() => handleInterventionDone()}
      />
    );
  }

  async function handleInterventionDone() {
    if (!activity || !session) return;
    await api.submitAnswerReliably(activity.id, { item_id: null, correct: true, response_time_ms: 0 });
    await goToNextActivity();
  }
  // "matching"/"sequencing" render the ENTIRE item set as one board
  // (MatchingBoard/SequenceBoard own their own progression), unlike
  // "counting"/"letter_identify" which step through activity.spec.items one
  // at a time via itemIndex — these two families don't share item shapes
  // (sequencing items have no "count"/"label" at all), so branch before
  // touching itemIndex-based derived values at all.
  const encouragement = activity.spec.encouragement;
  const guideText =
    phase === "feedback"
      ? lastCorrect
        ? encouragement[itemIndex % encouragement.length] ?? "Great job!"
        : "Almost! Let's try another one."
      : "Let's play!";

  let sceneAndAnswer: React.ReactNode;
  if (activity.spec.activity_kind === "matching") {
    sceneAndAnswer = (
      <>
        <IdentifyScene imageSource={avatarImageSource} promptText={activity.spec.prompt_text} />
        {/* key=activity.id forces a full remount per activity — without it,
            React reuses the same component instance across activities and
            its internal per-item state (which pairs are resolved) leaks
            into the NEXT board, whose items have different ids entirely. */}
        <MatchingBoard
          key={activity.id}
          items={activity.spec.items.map((i) => ({ id: i.id, label: "label" in i.answer ? i.answer.label : "" }))}
          onItemAnswered={handleBoardItemAnswered}
          onAllDone={handleBoardAllDone}
          disabled={phase !== "playing"}
        />
      </>
    );
  } else if (activity.spec.activity_kind === "sequencing") {
    sceneAndAnswer = (
      <>
        <IdentifyScene imageSource={avatarImageSource} promptText={activity.spec.prompt_text} />
        {/* key=activity.id — see the identical comment on MatchingBoard above. */}
        <SequenceBoard
          key={activity.id}
          items={activity.spec.items.map((i) => ({
            id: i.id,
            value: "value" in i.answer ? i.answer.value : 0,
            position: "position" in i.answer ? i.answer.position : 0,
          }))}
          method={activity.spec.method}
          onItemAnswered={handleBoardItemAnswered}
          onAllDone={handleBoardAllDone}
          disabled={phase !== "playing"}
        />
      </>
    );
  } else {
    const item = activity.spec.items[itemIndex];
    const answerValue = "label" in item.answer ? item.answer.label : "count" in item.answer ? item.answer.count : 0;
    const choices = [answerValue, ...item.distractors];
    // "letter_identify" prompts carry a "{label}" placeholder each item
    // fills in with its own target letter (content/generator's
    // identify_prompt_template) — counting prompts have no placeholder.
    const promptText =
      activity.spec.activity_kind === "letter_identify" && "label" in item.answer
        ? activity.spec.prompt_text.replace("{label}", item.answer.label)
        : activity.spec.prompt_text;

    sceneAndAnswer = (
      <>
        {activity.spec.activity_kind === "letter_identify" ? (
          <IdentifyScene imageSource={avatarImageSource} promptText={promptText} />
        ) : (
          <CountingScene theme={theme} count={"count" in item.answer ? item.answer.count : 0} promptText={promptText} />
        )}

        {activity.spec.modality === "drag_drop" ? (
          // key=item.id forces a clean remount per item, so the one-time
          // shuffle in DragDropAnswer can never re-run (and re-order tiles
          // under the child's finger) mid-gesture on an unrelated re-render.
          <DragDropAnswer key={item.id} choices={choices} onChoose={handleChoose} disabled={phase !== "playing"} />
        ) : (
          <TapAnswer key={item.id} choices={choices} onChoose={handleChoose} disabled={phase !== "playing"} />
        )}
      </>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: childColors.background, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={[styles.gateSlot, { top: insets.top + spacing.sm }]}>
        <ParentalGate onUnlock={finishForToday} />
      </View>

      <GuideBubble imageSource={avatarImageSource} accentColor={accentColor} text={guideText} />

      {sceneAndAnswer}

      {/* Research/debug strip — the adaptive engine's decisions. Off unless a grown-up
          turns it on in Settings > Research & development (dev builds only). */}
      {showDecisionOverlay && (
      <View style={[styles.debugStrip, { bottom: insets.bottom + spacing.xs }]}>
        <Text style={styles.debugText}>
          topic={activity.spec.topic_code} ({activity.spec.topic_reason}) · kind={activity.spec.activity_kind} ·
          difficulty={activity.spec.difficulty} · method={activity.spec.method} [
          {activity.spec.decision_types.teaching_method}] · modality={activity.spec.modality} [
          {activity.spec.decision_types.modality}] ·{" "}
          {activity.spec.activity_kind === "matching" || activity.spec.activity_kind === "sequencing"
            ? `resolved ${boardResolved}/${activity.spec.items.length}`
            : `item ${itemIndex + 1}/${activity.spec.items.length}`}{" "}
          · rounds={roundsCompleted}
        </Text>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  gateSlot: { position: "absolute", right: spacing.md, zIndex: 10 },
  loadingText: { marginTop: spacing.md, fontSize: 18, color: colors.textSecondary },
  errorText: { color: colors.textPrimary, fontSize: 16, textAlign: "center", marginBottom: spacing.lg },
  retryButton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 20 },
  retryButtonText: { color: "#fff", fontFamily: childFonts.bold, fontSize: 18 },
  debugStrip: { position: "absolute", left: spacing.md, right: spacing.md },
  debugText: { fontSize: 11, color: colors.textSecondary, textAlign: "center", fontFamily: "monospace" },
});
