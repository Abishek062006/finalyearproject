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
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptic, ParentalGate, playSound, useSettings, useTheme } from "../design";
import { CompanionStage } from "../companion/CompanionStage";
import { useBuddy } from "../companion/useBuddy";
import { IdentifyScene } from "./IdentifyScene";
import { MatchingBoard } from "./MatchingBoard";
import { CalmCorner } from "./CalmCorner";
import { BarAction, ChildBar, CHILD_BAR_HEIGHT } from "./ChildBar";
import { InterventionScreen } from "./InterventionScreen";
import { TalkBoard } from "./TalkBoard";
import { RewardTime } from "./RewardTime";
import { TokenBoard, TOKENS_FOR_REWARD } from "./TokenBoard";
import { BasketScene } from "./scenes/BasketScene";
import { MailboxScene } from "./scenes/MailboxScene";
import { SceneChoices } from "./scenes/SceneChoices";
import { TrainBoard } from "./scenes/TrainBoard";
import { api, API_BASE, Activity, Session } from "../shared/api";
import { pendingCount } from "../shared/offlineQueue";
import { colors, spacing, THEME_ASSETS, ThemeCode, childFonts } from "../shared/theme";

type Phase = "loading" | "playing" | "feedback" | "reward" | "error";

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Keeps content clear of the Grown-ups pill in the top corner. */
const GATE_CLEARANCE = 56;

/** On web, dragging a tile would otherwise highlight text across the screen. */
const NO_TEXT_SELECTION = Platform.OS === "web" ? ({ userSelect: "none" } as object) : null;

export function ChildScreen({
  childId,
  onExit,
  onAllDone,
  childName,
  buddySpecies,
  reduceMotion = false,
}: {
  childId: string;
  onExit: () => void;
  /** The child pressed "All done": the session ends and they go to their home screen. */
  onAllDone?: () => void;
  childName?: string;
  buddySpecies?: string;
  reduceMotion?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [boardResolved, setBoardResolved] = useState(0); // "matching"/"sequencing" only — how many of the whole-board items are answered so far
  const responseStartedAt = useRef<number>(Date.now());
  const [tokens, setTokens] = useState(0); // First-Then token board: stars toward play time
  const tokensRef = useRef(0);
  const [posted, setPosted] = useState(false); // mailbox flag, up while a right letter is being posted
  const targetRef = useRef<View>(null); // where an answer piece goes: the basket's tag, the mailbox slot
  const [overlay, setOverlay] = useState<"talk" | "calm" | null>(null); // Talk board / calm corner over the lesson
  const { colors: childColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showDecisionOverlay } = useSettings();
  const companionUri = activity?.spec.companion_image_url ? `${API_BASE}${activity.spec.companion_image_url}` : null;
  const buddy = useBuddy({ reduceMotion });
  const { width: windowWidth } = useWindowDimensions();
  const buddySize = Math.round(Math.min(128, Math.max(88, windowWidth * 0.26)));
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const contentOverflows = contentHeight > viewportHeight + 1;
  // Resolves once Pip has said hello, so the first prompt never talks over the greeting.
  const greeting = useRef<Promise<void>>(Promise.resolve());

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
      buddy.enter();
      buddy.gesture("wave");
      greeting.current = buddy.say(childName ? `Hi ${childName}! Let's play!` : "Hi! Let's play!", { mood: "happy" });
      setPhase("playing");
    } catch (err) {
      setErrorMessage(
        `${err instanceof Error ? err.message : String(err)}\n\nIs the backend running?\n` +
          "cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000"
      );
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Pip reads every question aloud (pre-readers can't read the prompt), then
  // looks down at the answers and points to them.
  const isBoard = activity?.spec.activity_kind === "matching" || activity?.spec.activity_kind === "sequencing";
  const promptKey = activity && !activity.spec.is_intervention ? `${activity.id}:${isBoard ? "board" : itemIndex}` : null;
  useEffect(() => {
    if (phase !== "playing" || !promptKey || !activity) return;
    let cancelled = false;
    (async () => {
      await greeting.current;
      if (cancelled) return;
      buddy.setMood("neutral");
      buddy.lookAt(0, 0);
      await buddy.say(currentPrompt(activity, itemIndex));
      if (cancelled) return;
      buddy.lookAt(0.35, 1);
      buddy.gesture("point");
      responseStartedAt.current = Date.now(); // response time starts once the question has been heard
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptKey, phase]);

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

  // MatchingBoard/TrainBoard resolve items in whatever order the child
  // taps them, not sequentially by itemIndex — each resolution is recorded
  // immediately, exactly like a single tap-choice answer.
  async function handleBoardItemAnswered(itemId: string, correct: boolean, responseTimeMs: number) {
    if (!activity) return;
    setBoardResolved((n) => n + 1);
    giveAnswerFeedback(correct, "board");
    if (correct) {
      buddy.setMood("happy");
      buddy.gesture("nod");
    } else {
      buddy.setMood("concerned");
      setTimeout(() => buddy.setMood("encouraging"), 900);
    }
    await api.submitAnswerReliably(activity.id, { item_id: itemId, correct, response_time_ms: responseTimeMs });
  }

  async function handleBoardAllDone() {
    haptic("success");
    playSound("celebrate");
    setRoundsCompleted((r) => r + 1);
    buddy.gesture("celebrate");
    await buddy.say(pickEncouragement(activity), { mood: "excited" });
    await finishActivity();
  }

  /** Every finished lesson earns a star; a full board earns play time before the next one. */
  async function finishActivity() {
    const earned = tokensRef.current + 1;
    tokensRef.current = earned;
    setTokens(earned);
    // Say the change is coming before it comes (a transition warning).
    if (earned === TOKENS_FOR_REWARD - 2) await buddy.say("Two more, then play time!", { mood: "happy" });
    if (earned < TOKENS_FOR_REWARD) return goToNextActivity();
    buddy.gesture("celebrate");
    setPhase("reward");
    await buddy.say("You got all your stars! Play time!", { mood: "excited" });
  }

  async function endRewardTime() {
    tokensRef.current = 0;
    setTokens(0);
    buddy.setMood("happy");
    await buddy.say("Time to learn again!");
    await goToNextActivity();
  }

  async function handleChoose(value: string | number) {
    if (!activity || !session || phase !== "playing") return;

    const item = activity.spec.items[itemIndex];
    const answerValue = "label" in item.answer ? item.answer.label : "count" in item.answer ? item.answer.count : 0;
    const correct = value === answerValue;
    const responseTimeMs = Date.now() - responseStartedAt.current;

    setPhase("feedback");
    giveAnswerFeedback(correct, "single");
    if (correct) setPosted(true);

    // Pip reacts, and the next question waits until it has finished talking.
    buddy.lookAt(0, 0);
    let reaction: Promise<void>;
    if (correct) {
      buddy.gesture(itemIndex % 2 === 0 ? "celebrate" : "clap");
      reaction = buddy.say(pickEncouragement(activity, itemIndex), { mood: "excited" });
    } else {
      buddy.setMood("concerned");
      reaction = buddy.say("Almost! Let's try another one.", { mood: "encouraging" });
    }

    await Promise.all([
      api.submitAnswerReliably(activity.id, { item_id: item.id, correct, response_time_ms: responseTimeMs }),
      reaction,
      new Promise((r) => setTimeout(r, 900)),
    ]);

    setPosted(false);
    const isLastItemInSet = itemIndex + 1 >= activity.spec.items.length;
    if (!isLastItemInSet) {
      setItemIndex((i) => i + 1);
      setPhase("playing");
      return;
    }
    setRoundsCompleted((r) => r + 1);
    await finishActivity();
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

  /** The always-on Talk / Break / Help / All done bar. */
  async function handleBar(action: BarAction) {
    const sessionId = session?.id;
    if (action === "talk") {
      setOverlay("talk");
    } else if (action === "break") {
      buddy.stop();
      api.sendSignal(childId, "break", {}, sessionId); // tells the safety layer to go gentle
      setOverlay("calm");
    } else if (action === "help") {
      api.sendSignal(childId, "help", {}, sessionId);
      if (!activity || activity.spec.is_intervention) return;
      buddy.lookAt(0, 0);
      await buddy.say(`Let's do it together. ${currentPrompt(activity, itemIndex)}`, { mood: "encouraging" });
      buddy.lookAt(0.35, 1);
      buddy.gesture("point");
    } else {
      api.sendSignal(childId, "all_done", {}, sessionId);
      buddy.gesture("wave");
      await buddy.say("Okay, all done! Great work today.", { mood: "happy" });
      if (sessionId) api.endSession(sessionId, "child_all_done").catch(() => {});
      (onAllDone ?? onExit)();
    }
  }

  // Only reachable through the grown-ups gate (ParentalGate) — never a plain tap.
  async function finishForToday() {
    buddy.stop();
    if (session) {
      try {
        await api.endSession(session.id, "grown_up");
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
  // theme the actual lesson content (the counting basket's objects) uses.
  const avatarImageSource = activity.spec.companion_image_url
    ? { uri: `${API_BASE}${activity.spec.companion_image_url}` }
    : THEME_ASSETS[theme].image;

  if (activity.spec.is_intervention && phase !== "reward") {
    return (
      <InterventionScreen
        type={activity.spec.intervention_type!}
        guideName={activity.spec.guide_name}
        imageSource={avatarImageSource}
        species={buddySpecies}
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
  // (MatchingBoard/TrainBoard own their own progression), unlike
  // "counting"/"letter_identify" which step through activity.spec.items one
  // at a time via itemIndex — these two families don't share item shapes
  // (sequencing items have no "count"/"label" at all), so branch before
  // touching itemIndex-based derived values at all.

  const level = activity.spec.difficulty ?? 1;
  const modality = activity.spec.modality === "drag_drop" ? "drag_drop" : "tap";

  let sceneAndAnswer: React.ReactNode;
  if (phase === "reward") {
    sceneAndAnswer = (
      <RewardTime
        rewardUri={companionUri}
        theme={theme}
        reduceMotion={reduceMotion}
        onPop={(n) => {
          if (n % 3 === 0) buddy.gesture("clap");
        }}
        onDone={endRewardTime}
      />
    );
  } else if (activity.spec.activity_kind === "matching") {
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
      // key=activity.id — see the identical comment on MatchingBoard above.
      <TrainBoard
        key={activity.id}
        items={activity.spec.items.map((i) => ({
          id: i.id,
          value: "value" in i.answer ? i.answer.value : 0,
          position: "position" in i.answer ? i.answer.position : 0,
        }))}
        method={activity.spec.method}
        level={level}
        promptText={activity.spec.prompt_text}
        reduceMotion={reduceMotion}
        onItemAnswered={handleBoardItemAnswered}
        onAllDone={handleBoardAllDone}
        disabled={phase !== "playing"}
      />
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

    const isLetters = activity.spec.activity_kind === "letter_identify";

    sceneAndAnswer = (
      <>
        {isLetters ? (
          <MailboxScene promptText={promptText} posted={posted} targetRef={targetRef} />
        ) : (
          <BasketScene
            key={`basket-${item.id}`}
            theme={theme}
            count={"count" in item.answer ? item.answer.count : 0}
            level={level}
            itemKey={item.id}
            promptText={promptText}
            targetRef={targetRef}
            onCount={(n) => {
              buddy.say(NUMBER_WORDS[n] ?? String(n), { mood: "happy" });
              responseStartedAt.current = Date.now(); // time the answer from the last count, not from the question
            }}
          />
        )}
        {/* key=item.id: fresh pieces (and a fresh shuffle) for every question. */}
        <SceneChoices
          key={`pieces-${item.id}`}
          kind={isLetters ? "envelope" : "block"}
          modality={modality}
          choices={choices}
          correctValue={answerValue}
          targetRef={targetRef}
          onChoose={handleChoose}
          disabled={phase !== "playing"}
          reduceMotion={reduceMotion}
        />
      </>
    );
  }

  return (
    <View style={[styles.container, NO_TEXT_SELECTION, { backgroundColor: childColors.background }]}>
      <View style={[styles.gateSlot, { top: insets.top + spacing.sm }]}>
        <ParentalGate onUnlock={finishForToday} />
      </View>
      <View style={[styles.tokenSlot, { top: insets.top + spacing.sm }]}>
        <TokenBoard earned={tokens} rewardUri={companionUri} theme={theme} reduceMotion={reduceMotion} />
      </View>

      {/* Centred when everything fits; scrolls only when it doesn't (short phones,
          landscape). Scrolling stays OFF otherwise so it can never fight a drag. */}
      <ScrollView
        scrollEnabled={contentOverflows}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentHeight(h)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + GATE_CLEARANCE, paddingBottom: CHILD_BAR_HEIGHT + insets.bottom + spacing.md }]}
      >
        <View style={styles.column}>
          <CompanionStage buddy={buddy} holdingUri={companionUri} size={buddySize} species={buddySpecies} />
          {sceneAndAnswer}
        </View>
      </ScrollView>

      <View style={styles.barSlot}>
        <ChildBar onAction={handleBar} bottomInset={insets.bottom} />
      </View>

      {overlay && (
        <View style={[styles.overlay, { paddingTop: insets.top + GATE_CLEARANCE }]}>
          {overlay === "talk" ? (
            <TalkBoard childId={childId} sessionId={session?.id} onClose={() => setOverlay(null)} />
          ) : (
            <CalmCorner
              childId={childId}
              sessionId={session?.id}
              buddy={buddy}
              species={buddySpecies}
              reduceMotion={reduceMotion}
              onReady={() => {
                setOverlay(null);
                buddy.say("Welcome back! Let's keep going.", { mood: "happy" });
              }}
            />
          )}
        </View>
      )}

      {/* Research/debug strip — the adaptive engine's decisions. Off unless a grown-up
          turns it on in Settings > Research & development (dev builds only). */}
      {showDecisionOverlay && (
      <View style={[styles.debugStrip, { bottom: CHILD_BAR_HEIGHT + insets.bottom + spacing.xs }]}>
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
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.lg },
  column: { width: "100%", maxWidth: 760, alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  gateSlot: { position: "absolute", right: spacing.md, zIndex: 10 },
  tokenSlot: { position: "absolute", left: spacing.md, zIndex: 10 },
  barSlot: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 5 },
  // Over the lesson, under the grown-ups gate (zIndex 10), so a grown-up can always get out.
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 8, backgroundColor: "#EEF3F9" },
  loadingText: { marginTop: spacing.md, fontSize: 18, color: colors.textSecondary },
  errorText: { color: colors.textPrimary, fontSize: 16, textAlign: "center", marginBottom: spacing.lg },
  retryButton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 20 },
  retryButtonText: { color: "#fff", fontFamily: childFonts.bold, fontSize: 18 },
  debugStrip: { position: "absolute", left: spacing.md, right: spacing.md },
  debugText: { fontSize: 11, color: colors.textSecondary, textAlign: "center", fontFamily: "monospace" },
});

/** The spoken form of the current question — letter prompts fill in their target letter. */
function currentPrompt(activity: Activity, itemIndex: number): string {
  const item = activity.spec.items[itemIndex];
  if (activity.spec.activity_kind === "letter_identify" && item && "label" in item.answer) {
    return activity.spec.prompt_text.replace("{label}", item.answer.label);
  }
  return activity.spec.prompt_text;
}

function pickEncouragement(activity: Activity | null, index = 0): string {
  const lines = activity?.spec.encouragement ?? [];
  return lines.length ? lines[index % lines.length] : "Great job!";
}
