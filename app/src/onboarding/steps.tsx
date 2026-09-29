/**
 * The onboarding questions as plain controlled components (value in,
 * onChange out). The setup flow and the later "edit profile" screens both
 * render these, so an answer looks and behaves the same wherever it's given.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from "react-native-reanimated";
import { haptic, OptionCard, PressableScale, radius, spacing, Text, useTheme, WheelPicker } from "../design";
import { API_BASE, CommunicationLevel, SensoryFlag } from "../shared/api";
import { pickChildPhoto } from "../shared/childPhotos";
import { speak, stopSpeaking } from "../shared/speech";
import { InterestSearch } from "./InterestSearch";
import { COMMUNICATION_OPTIONS, GOAL_OPTIONS, SENSORY_OPTIONS, ageInYears } from "./options";

// ---- Name + optional photo ----

export function NameStep({
  name,
  onName,
  photo,
  onPhoto,
  onSubmit,
}: {
  name: string;
  onName: (v: string) => void;
  photo: string | null;
  onPhoto: (uri: string | null) => void;
  onSubmit?: () => void;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={{ alignItems: "center" }}>
      <PressableScale
        haptic="select"
        onPress={async () => {
          const uri = await pickChildPhoto();
          if (uri) onPhoto(uri);
        }}
        accessibilityLabel={photo ? "Change photo" : "Add a photo (optional)"}
        style={[styles.avatar, { backgroundColor: colors.fill }]}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatarImage} />
        ) : name.trim() ? (
          <Text variant="largeTitle" tone="secondary">
            {name.trim()[0].toUpperCase()}
          </Text>
        ) : (
          <Ionicons name="camera" size={34} color={colors.labelTertiary} />
        )}
        <View style={[styles.avatarBadge, { backgroundColor: colors.tint, borderColor: colors.background }]}>
          <Ionicons name={photo ? "pencil" : "add"} size={16} color="#fff" />
        </View>
      </PressableScale>
      <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {photo ? "Photo stays on this device only" : "Add a photo (optional, stays on this device)"}
      </Text>
      <TextInput
        value={name}
        onChangeText={onName}
        placeholder="First name or nickname"
        placeholderTextColor={colors.labelTertiary}
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus
        maxLength={40}
        returnKeyType="next"
        onSubmitEditing={onSubmit}
        textContentType="nickname"
        accessibilityLabel="Child's first name or nickname"
        style={[type("title2"), styles.bigInput, { color: colors.label, borderBottomColor: colors.tint }]}
      />
    </View>
  );
}

// ---- Age ----

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function AgeStep({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  const now = new Date();
  const [year, month] = value.split("-").map(Number);
  const years = useMemo(
    () => Array.from({ length: 17 }, (_, i) => now.getFullYear() - 1 - i).map((y) => ({ label: String(y), value: y })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const months = useMemo(() => MONTHS.map((m, i) => ({ label: m, value: i + 1 })), []);
  const set = (y: number, m: number) => onChange(`${y}-${String(m).padStart(2, "0")}`);
  const age = ageInYears(value, now);

  return (
    <View style={{ alignItems: "center" }}>
      <View style={styles.wheels}>
        <WheelPicker items={months} value={month} onChange={(m) => set(year, m)} width={170} accessibilityLabel="Birth month" />
        <WheelPicker items={years} value={year} onChange={(y) => set(y, month)} width={110} accessibilityLabel="Birth year" />
      </View>
      <Text variant="title3" tone="secondary" style={{ marginTop: spacing.lg }}>
        {name || "Your child"} is {age} {age === 1 ? "year" : "years"} old
      </Text>
    </View>
  );
}

// ---- Communication ----

export function CommunicationStep({ value, onChange }: { value: CommunicationLevel | null; onChange: (v: CommunicationLevel) => void }) {
  return (
    <View accessibilityRole="radiogroup">
      {COMMUNICATION_OPTIONS.map((o) => (
        <OptionCard key={o.value} title={o.title} subtitle={o.subtitle} icon={o.icon} iconColor={o.color} selected={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

// ---- Sensory ----

export function SensoryStep({ value, onChange }: { value: SensoryFlag[]; onChange: (v: SensoryFlag[]) => void }) {
  const toggle = (flag: SensoryFlag) => onChange(value.includes(flag) ? value.filter((f) => f !== flag) : [...value, flag]);
  return (
    <View>
      {SENSORY_OPTIONS.map((o) => (
        <OptionCard key={o.value} kind="multi" title={o.title} subtitle={o.subtitle} icon={o.icon} iconColor={o.color} selected={value.includes(o.value)} onPress={() => toggle(o.value)} />
      ))}
      <OptionCard kind="multi" title="None of these" icon="checkmark-circle" iconColor="#8E8E93" selected={value.length === 0} onPress={() => onChange([])} />
    </View>
  );
}

// ---- Goals ----

export function GoalsStep({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (goal: string) => onChange(value.includes(goal) ? value.filter((g) => g !== goal) : [...value, goal]);
  const picksUpcoming = value.some((v) => !GOAL_OPTIONS.find((o) => o.value === v)?.available);
  return (
    <View>
      {GOAL_OPTIONS.map((o) => (
        <OptionCard key={o.value} kind="multi" title={o.title} subtitle={o.subtitle} icon={o.icon} iconColor={o.color} selected={value.includes(o.value)} onPress={() => toggle(o.value)} />
      ))}
      {picksUpcoming && (
        <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.xs }}>
          AURA starts with numbers and letters. Activities for the other areas you picked are on the way, and your choices are saved for when they arrive.
        </Text>
      )}
    </View>
  );
}

// ---- Interests (onboarding: pick several, one favourite) ----

export interface DraftInterest {
  label: string;
  image_url: string;
  thumb_url: string | null;
  source_title: string;
  favourite: boolean;
}

export const MAX_INTERESTS = 6;

export function InterestsStep({ name, value, onChange }: { name: string; value: DraftInterest[]; onChange: (v: DraftInterest[]) => void }) {
  const { colors } = useTheme();

  function pick(label: string, candidate: { image_url: string; thumb_url: string | null; source_title: string }) {
    const key = label.toLowerCase();
    const existing = value.find((v) => v.label.toLowerCase() === key);
    if (existing?.image_url === candidate.image_url) {
      remove(existing.label);
      return;
    }
    const others = value.filter((v) => v.label.toLowerCase() !== key);
    if (!existing && others.length >= MAX_INTERESTS) return;
    const next = [...others, { label, ...candidate, favourite: existing?.favourite ?? others.length === 0 }];
    onChange(next);
  }

  function remove(label: string) {
    const rest = value.filter((v) => v.label !== label);
    if (rest.length && !rest.some((r) => r.favourite)) rest[0] = { ...rest[0], favourite: true };
    onChange(rest);
  }

  function favourite(label: string) {
    haptic("select");
    onChange(value.map((v) => ({ ...v, favourite: v.label === label })));
  }

  return (
    <View>
      {value.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text variant="footnote" tone="secondary" style={{ marginBottom: spacing.xs }}>
            {name || "Your child"} loves · tap one to make it their favourite (their companion)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {value.map((v) => (
              <Animated.View key={v.label} entering={ZoomIn.springify().damping(16)} style={styles.trayItem}>
                <Pressable
                  onPress={() => favourite(v.label)}
                  accessibilityRole="button"
                  accessibilityLabel={`${v.label}${v.favourite ? ", favourite" : ". Make favourite"}`}
                  style={[styles.trayPhotoWrap, { borderColor: v.favourite ? colors.tint : "transparent" }]}
                >
                  <Image source={{ uri: v.thumb_url ?? v.image_url }} style={styles.trayPhoto} />
                  {v.favourite && (
                    <View style={[styles.star, { backgroundColor: colors.tint }]}>
                      <Ionicons name="star" size={11} color="#fff" />
                    </View>
                  )}
                </Pressable>
                <Pressable onPress={() => remove(v.label)} accessibilityRole="button" accessibilityLabel={`Remove ${v.label}`} hitSlop={8} style={[styles.remove, { backgroundColor: colors.label }]}>
                  <Ionicons name="close" size={12} color={colors.surface} />
                </Pressable>
                <Text variant="caption" numberOfLines={1} style={{ marginTop: 4, maxWidth: 76, textTransform: "capitalize" }}>
                  {v.label}
                </Text>
              </Animated.View>
            ))}
          </ScrollView>
        </View>
      )}
      <InterestSearch
        onPick={({ label, candidate }) => pick(label, candidate)}
        isPicked={(c) => value.some((v) => v.image_url === c.image_url)}
      />
    </View>
  );
}

// ---- Meet the companion ----

export function MeetCompanionStep({ name, companionName, companionImageUrl }: { name: string; companionName: string | null; companionImageUrl: string | null }) {
  const { colors } = useTheme();
  const breathe = useSharedValue(1);
  const greeting = companionName
    ? `Hi ${name}! I love ${companionName.toLowerCase()} too. Let's learn together!`
    : `Hi ${name}! I'm so happy to meet you. Let's learn together!`;

  useEffect(() => {
    breathe.value = withRepeat(withSequence(withTiming(1.04, { duration: 1600, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) })), -1);
    const t = setTimeout(() => speak(greeting), 500);
    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));

  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View style={[styles.companion, { backgroundColor: colors.fill, shadowColor: colors.tint }, breatheStyle]}>
        {companionImageUrl ? (
          <Image source={{ uri: `${API_BASE}${companionImageUrl}` }} style={styles.companionImage} />
        ) : (
          <Ionicons name="sparkles" size={64} color={colors.tint} />
        )}
      </Animated.View>
      <View style={[styles.bubble, { backgroundColor: colors.surface }]}>
        <Text variant="title3" align="center">
          “{greeting}”
        </Text>
      </View>
      <PressableScale haptic="select" onPress={() => speak(greeting)} style={styles.replay} accessibilityLabel="Hear the greeting again">
        <Ionicons name="volume-medium" size={18} color={colors.tint} />
        <Text variant="subhead" tone="tint" style={{ marginLeft: 6, fontWeight: "600" }}>
          Hear it again
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 112, height: 112, borderRadius: 56 },
  avatarBadge: { position: "absolute", right: 2, bottom: 2, width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  bigInput: { alignSelf: "stretch", textAlign: "center", borderBottomWidth: 2, paddingVertical: spacing.sm },
  wheels: { flexDirection: "row", gap: spacing.sm },
  trayItem: { alignItems: "center", paddingTop: 6, paddingRight: 6 },
  trayPhotoWrap: { width: 72, height: 72, borderRadius: radius.lg, borderWidth: 3, overflow: "hidden" },
  trayPhoto: { width: "100%", height: "100%" },
  star: { position: "absolute", left: 4, bottom: 4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  remove: { position: "absolute", top: 0, right: 0, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  companion: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  companionImage: { width: 200, height: 200 },
  bubble: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.xl, maxWidth: 420 },
  replay: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, padding: spacing.xs },
});
