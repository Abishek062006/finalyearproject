/**
 * Plan Phase 1: setting up a child, one friendly question per screen — the
 * way a phone's setup assistant works, not a form. Nothing is saved until
 * the last question: then one call creates the child with everything
 * (backend parent_service.onboard_child, all-or-nothing), and the flow ends
 * by meeting the companion and handing the tablet over.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeOut, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, CONTENT_MAX_WIDTH, haptic, radius, spacing, springs, Text, useTheme } from "../design";
import { api, Child, CommunicationLevel, SensoryFlag } from "../shared/api";
import { saveChildPhoto } from "../shared/childPhotos";
import { BuddyPicker } from "../companion/BuddyPicker";
import { SpeciesCode } from "../companion/species";
import { HandoverStep } from "./HandoverStep";
import { AgeStep, CommunicationStep, DraftInterest, GoalsStep, InterestsStep, MeetCompanionStep, NameStep, SensoryStep } from "./steps";

type StepId = "name" | "age" | "communication" | "interests" | "sensory" | "goals" | "friend" | "meet" | "handover";
const QUESTIONS: StepId[] = ["name", "age", "communication", "interests", "sensory", "goals", "friend"];
const ALL: StepId[] = [...QUESTIONS, "meet", "handover"];

function defaultBirth(): string {
  const d = new Date();
  return `${d.getFullYear() - 5}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function OnboardingScreen({ onFinish }: { onFinish: (result: { childId: string; play: boolean } | null) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [confirmingExit, setConfirmingExit] = useState(false);

  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [birth, setBirth] = useState(defaultBirth);
  const [communication, setCommunication] = useState<CommunicationLevel | null>(null);
  const [interests, setInterests] = useState<DraftInterest[]>([]);
  const [sensory, setSensory] = useState<SensoryFlag[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [buddySpecies, setBuddySpecies] = useState<SpeciesCode>("pip");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [child, setChild] = useState<Child | null>(null);

  const step = ALL[stepIndex];
  const displayName = name.trim() || "your child";
  const created = child !== null;

  const canContinue: Record<StepId, boolean> = {
    name: name.trim().length > 0,
    age: true,
    communication: communication !== null,
    interests: true,
    sensory: true,
    goals: goals.length > 0,
    friend: true,
    meet: true,
    handover: true,
  };

  const copy: Record<StepId, { title: string; subtitle?: string }> = {
    name: { title: "Who's learning?", subtitle: "We'll use this name when their companion talks to them." },
    age: { title: `When was ${displayName} born?`, subtitle: "Just the month and year, to pick the right activities." },
    communication: { title: `How does ${displayName} usually communicate?`, subtitle: "So we know how to ask questions and take answers." },
    interests: { title: `What does ${displayName} love?`, subtitle: "Search for anything. Their favourite becomes their learning companion." },
    sensory: { title: `Does anything bother ${displayName}?`, subtitle: "We'll tune the app around it. You can change this any time." },
    goals: { title: `What should ${displayName} work on?`, subtitle: "Pick as many as you like." },
    friend: { title: `Pick ${displayName}'s learning friend`, subtitle: "They'll learn together every day. You can change this later." },
    meet: { title: `Meet ${child?.buddy ?? "your friend"}`, subtitle: `${displayName}'s learning friend` },
    handover: { title: `Hand the tablet to ${displayName}` },
  };

  function go(delta: 1 | -1) {
    setDirection(delta);
    setError("");
    setStepIndex((i) => Math.min(ALL.length - 1, Math.max(0, i + delta)));
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const result = await api.onboardChild({
        nickname: name.trim(),
        birth_year_month: birth,
        communication_level: communication,
        sensory,
        goals,
        interests: interests.map(({ label, image_url, source_title, favourite }) => ({ label, image_url, source_title, favourite })),
        buddy_species: buddySpecies,
      });
      if (photo) await saveChildPhoto(result.id, photo);
      setChild(result);
      haptic("success");
      go(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.includes("400") ? message.replace(/^.*?: /, "").replace(/[{}"]/g, "").replace("detail:", "").trim() : "Couldn't save right now. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function onPrimary() {
    if (step === "friend") return submit();
    if (step === "handover") return onFinish({ childId: child!.id, play: true });
    go(1);
  }

  const progressStyle = useAnimatedStyle(() => ({
    width: withSpring(`${((Math.min(stepIndex, QUESTIONS.length - 1) + 1) / QUESTIONS.length) * 100}%`, springs.gentle),
  }));

  const primaryTitle =
    step === "friend" ? `Set up ${displayName}'s space` : step === "handover" ? `Start ${displayName}'s first session` : step === "meet" ? "Continue" : "Continue";

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Top bar: back/close + progress */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.topSide}>
          {!created && stepIndex > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Previous question" hitSlop={12} onPress={() => { haptic("select"); go(-1); }}>
              <Ionicons name="chevron-back" size={28} color={colors.tint} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={created ? "Finish later" : "Cancel setup"}
              hitSlop={12}
              onPress={() => (created ? onFinish({ childId: child!.id, play: false }) : stepIndex === 0 ? onFinish(null) : setConfirmingExit(true))}
            >
              <Ionicons name="close" size={28} color={colors.labelSecondary} />
            </Pressable>
          )}
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          {!created && (
            <View style={[styles.progressTrack, { backgroundColor: colors.fill }]} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: QUESTIONS.length, now: stepIndex + 1 }}>
              <Animated.View style={[styles.progressFill, { backgroundColor: colors.tint }, progressStyle]} />
            </View>
          )}
        </View>
        <View style={styles.topSide}>
          {!created && stepIndex > 0 && (
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel setup" hitSlop={12} onPress={() => setConfirmingExit(true)} style={{ alignSelf: "flex-end" }}>
              <Ionicons name="close" size={26} color={colors.labelSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <Animated.View
          key={step}
          entering={(direction === 1 ? FadeInRight : FadeInLeft).duration(280)}
          exiting={FadeOut.duration(100)}
          style={styles.column}
        >
          <Text variant="title1" align="center" accessibilityRole="header">
            {copy[step].title}
          </Text>
          {copy[step].subtitle && (
            <Text variant="body" tone="secondary" align="center" style={styles.subtitle}>
              {copy[step].subtitle}
            </Text>
          )}
          <View style={{ marginTop: spacing.xl }}>
            {step === "name" && <NameStep name={name} onName={setName} photo={photo} onPhoto={setPhoto} onSubmit={() => canContinue.name && go(1)} />}
            {step === "age" && <AgeStep name={name.trim()} value={birth} onChange={setBirth} />}
            {step === "communication" && <CommunicationStep value={communication} onChange={setCommunication} />}
            {step === "interests" && <InterestsStep name={name.trim()} value={interests} onChange={setInterests} />}
            {step === "sensory" && <SensoryStep value={sensory} onChange={setSensory} />}
            {step === "goals" && <GoalsStep value={goals} onChange={setGoals} />}
            {step === "friend" && <BuddyPicker value={buddySpecies} onChange={setBuddySpecies} childName={name.trim()} />}
            {step === "meet" && child && (
              <MeetCompanionStep
                name={child.nickname}
                buddyName={child.buddy}
                species={child.buddy_species}
                companionName={child.companion_name}
                companionImageUrl={child.companion_image_url}
              />
            )}
            {step === "handover" && child && <HandoverStep child={child} />}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom bar: primary action (+ skip on the optional step) */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md, borderTopColor: colors.separator, backgroundColor: colors.background }]}>
        <View style={styles.column}>
          {!!error && (
            <Text variant="footnote" tone="destructive" align="center" style={{ marginBottom: spacing.sm }}>
              {error}
            </Text>
          )}
          <Button title={primaryTitle} onPress={onPrimary} disabled={!canContinue[step]} loading={saving} />
          {step === "interests" && interests.length === 0 && (
            <Button title="Skip for now" variant="plain" size="medium" fullWidth style={{ marginTop: spacing.xs }} onPress={() => go(1)} />
          )}
          {step === "handover" && (
            <Button title="Not now" variant="plain" size="medium" fullWidth style={{ marginTop: spacing.xs }} onPress={() => onFinish({ childId: child!.id, play: false })} />
          )}
        </View>
      </View>

      {confirmingExit && (
        <Animated.View entering={FadeIn.duration(150)} style={[styles.confirmScrim, { backgroundColor: colors.overlay }]}>
          <View style={[styles.confirmCard, { backgroundColor: colors.surface }]}>
            <Text variant="headline" align="center">
              Stop setting up?
            </Text>
            <Text variant="subhead" tone="secondary" align="center" style={{ marginTop: 4, marginBottom: spacing.md }}>
              Your answers so far won't be saved.
            </Text>
            <Button title="Keep going" onPress={() => setConfirmingExit(false)} />
            <Button title="Stop setup" variant="plain" size="medium" fullWidth style={{ marginTop: spacing.xs }} onPress={() => onFinish(null)} />
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.xs, gap: spacing.md },
  topSide: { width: 32 },
  progressTrack: { width: "100%", height: 5, borderRadius: 3, overflow: "hidden", maxWidth: CONTENT_MAX_WIDTH },
  progressFill: { height: "100%", borderRadius: 3 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  column: { width: "100%", maxWidth: 520, alignSelf: "center" },
  subtitle: { marginTop: spacing.xs },
  bottomBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  confirmScrim: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  confirmCard: { width: "100%", maxWidth: 340, borderRadius: radius.xl, padding: spacing.lg },
});
