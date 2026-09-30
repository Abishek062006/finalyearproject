/**
 * The child's own home in the app, usable any time, not only in lessons:
 * Learn with their buddy, see My day (visual schedule), Talk (picture
 * board), go to the Calm corner, or Wait with a visual timer. The only way
 * out is the grown-ups' press-and-hold gate, same as the lesson screen.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CompanionStage } from "../companion/CompanionStage";
import { useBuddy } from "../companion/useBuddy";
import { haptic, ParentalGate, spacing } from "../design";
import { API_BASE, Child } from "../shared/api";
import { childFonts } from "../shared/theme";
import { CalmCorner } from "./CalmCorner";
import { MyDay } from "./MyDay";
import { TalkBoard } from "./TalkBoard";
import { WaitTimer } from "./WaitTimer";

type View_ = "home" | "day" | "talk" | "calm" | "wait";

const TILES: { view: View_ | "learn"; label: string; icon: keyof typeof Ionicons.glyphMap; tint: string; fill: string }[] = [
  { view: "learn", label: "Learn", icon: "star", tint: "#0071E3", fill: "#DCEAFB" },
  { view: "day", label: "My day", icon: "calendar", tint: "#B7791F", fill: "#FBEFD5" },
  { view: "talk", label: "Talk", icon: "chatbubbles", tint: "#8E44AD", fill: "#EFE2F6" },
  { view: "calm", label: "Calm", icon: "leaf", tint: "#2E8B57", fill: "#DDF2E3" },
  { view: "wait", label: "Wait", icon: "hourglass", tint: "#3C6E91", fill: "#DDEBF4" },
];

export function ChildHome({
  child,
  reduceMotion,
  onLearn,
  onExit,
}: {
  child: Child;
  reduceMotion: boolean;
  onLearn: () => void;
  onExit: () => void;
}) {
  const [view, setView] = useState<View_>("home");
  const buddy = useBuddy({ reduceMotion });
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tile = Math.min(200, (Math.min(width, 720) - 48 - 16) / 2);
  const companionUri = child.companion_image_url ? `${API_BASE}${child.companion_image_url}` : null;

  useEffect(() => {
    if (view === "home") {
      buddy.enter();
      buddy.gesture("wave");
      buddy.say(`Hi ${child.nickname}! What shall we do?`, { mood: "happy" });
    } else if (view === "wait") {
      buddy.say("Let's wait together. How long?", { mood: "neutral" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function open(v: View_ | "learn") {
    haptic("select");
    buddy.stop();
    if (v === "learn") onLearn();
    else setView(v);
  }

  const back = (
    <Pressable onPress={() => setView("home")} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
      <Ionicons name="chevron-back" size={28} color="#1D2433" />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );

  let body: React.ReactNode;
  if (view === "talk") {
    body = <TalkBoard childId={child.id} onClose={() => setView("home")} />;
  } else if (view === "calm") {
    body = (
      <>
        {back}
        <CalmCorner childId={child.id} buddy={buddy} species={child.buddy_species} reduceMotion={reduceMotion} onReady={() => setView("home")} />
      </>
    );
  } else if (view === "day") {
    body = (
      <>
        {back}
        <MyDay
          childId={child.id}
          childName={child.nickname}
          steps={child.schedule ?? []}
          onStepDone={(_step, next) => buddy.say(next ? `Well done! Next is ${next.label}.` : "Well done! That's everything for today.", { mood: "happy" })}
        />
      </>
    );
  } else if (view === "wait") {
    body = (
      <>
        {back}
        <View style={styles.stageSmall}>
          <CompanionStage buddy={buddy} size={96} species={child.buddy_species} />
        </View>
        <WaitTimer onWarn={(text) => buddy.say(text)} onFinish={() => buddy.say("Waiting is all done! Great waiting.", { mood: "happy" })} />
      </>
    );
  } else {
    body = (
      <ScrollView contentContainerStyle={styles.homeContent}>
        <CompanionStage buddy={buddy} holdingUri={companionUri} size={120} species={child.buddy_species} />
        <View style={styles.tiles}>
          {TILES.map((t) => (
            <Pressable
              key={t.view}
              onPress={() => open(t.view)}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              style={({ pressed }) => [styles.tile, { width: tile, height: tile * 0.8, backgroundColor: t.fill }, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Ionicons name={t.icon} size={tile * 0.28} color={t.tint} />
              <Text style={[styles.tileText, { color: t.tint }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 56 }]}>
      <View style={[styles.gate, { top: insets.top + spacing.sm }]}>
        <ParentalGate onUnlock={onExit} />
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#EEF3F9" },
  gate: { position: "absolute", right: spacing.md, zIndex: 10 },
  homeContent: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 40 },
  tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, maxWidth: 720, marginTop: 8 },
  tile: { borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 6 },
  tileText: { fontFamily: childFonts.bold, fontSize: 24 },
  back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", minHeight: 56, paddingHorizontal: 16 },
  backText: { fontFamily: childFonts.bold, fontSize: 20, color: "#1D2433" },
  stageSmall: { paddingHorizontal: 24, width: "100%", maxWidth: 560, alignSelf: "center" },
});
