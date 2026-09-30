/**
 * The Talk board — a picture-communication (AAC) board in the style of
 * Proloquo2Go and PECS books. Touching a picture says its word out loud and
 * adds it to the sentence strip; "Say it" speaks the whole sentence.
 *
 * Colours follow the Fitzgerald key used on AAC boards everywhere, so a
 * child who already uses one at school finds words where they expect them:
 * people yellow, actions green, describing words blue, social words pink,
 * "no / stop" red, things orange. The parent's own photo buttons (their
 * cup, their bike, grandma) come last, as things.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { haptic } from "../design";
import { api } from "../shared/api";
import { useTalkButtons } from "../shared/deviceLists";
import { speak } from "../shared/speech";
import { childFonts } from "../shared/theme";

type WordClass = "person" | "action" | "describe" | "social" | "negation" | "thing";

const CLASS_COLOURS: Record<WordClass, { fill: string; edge: string }> = {
  person: { fill: "#FFF1B8", edge: "#E6C84F" },
  action: { fill: "#D8F2CF", edge: "#7CC26B" },
  describe: { fill: "#D6E8FB", edge: "#6FA6E6" },
  social: { fill: "#FBDDEA", edge: "#E58BB0" },
  negation: { fill: "#FBD9D5", edge: "#E08A80" },
  thing: { fill: "#FFE3C4", edge: "#E9A45C" },
};

const CORE_WORDS: { word: string; icon: keyof typeof Ionicons.glyphMap; cls: WordClass }[] = [
  { word: "I", icon: "person", cls: "person" },
  { word: "want", icon: "hand-left", cls: "action" },
  { word: "more", icon: "add-circle", cls: "describe" },
  { word: "help", icon: "help-buoy", cls: "action" },
  { word: "break", icon: "pause-circle", cls: "action" },
  { word: "all done", icon: "checkmark-done", cls: "social" },
  { word: "yes", icon: "thumbs-up", cls: "social" },
  { word: "no", icon: "thumbs-down", cls: "negation" },
  { word: "stop", icon: "hand-right", cls: "negation" },
  { word: "go", icon: "arrow-forward-circle", cls: "action" },
  { word: "like", icon: "heart", cls: "action" },
  { word: "don't like", icon: "heart-dislike", cls: "negation" },
  { word: "eat", icon: "restaurant", cls: "action" },
  { word: "drink", icon: "water", cls: "action" },
  { word: "play", icon: "game-controller", cls: "action" },
  { word: "toilet", icon: "male-female", cls: "thing" },
  { word: "hurt", icon: "bandage", cls: "describe" },
  { word: "tired", icon: "bed", cls: "describe" },
];

type Word = { id: string; word: string };

export function TalkBoard({
  childId,
  sessionId,
  onClose,
}: {
  childId: string;
  sessionId?: string | null;
  onClose: () => void;
}) {
  const [sentence, setSentence] = useState<Word[]>([]);
  const [custom] = useTalkButtons(childId);
  const { width } = useWindowDimensions();
  const columns = width >= 900 ? 6 : width >= 600 ? 5 : 3;
  const tile = Math.min(132, (Math.min(width, 980) - 40 - (columns - 1) * 12) / columns);

  function add(word: string) {
    haptic("tap");
    speak(word);
    setSentence((s) => (s.length >= 12 ? s : [...s, { id: `${Date.now()}-${s.length}`, word }]));
  }

  function sayIt() {
    if (!sentence.length) return;
    const words = sentence.map((w) => w.word);
    haptic("success");
    speak(words.join(" "));
    api.sendSignal(childId, "talk", { words }, sessionId);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close talk board" style={styles.close}>
          <Ionicons name="chevron-back" size={28} color="#1D2433" />
          <Text style={styles.closeText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.strip} accessibilityLabel={sentence.length ? `Sentence: ${sentence.map((w) => w.word).join(" ")}` : "Sentence strip, empty"}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripWords}>
          {sentence.length === 0 && <Text style={styles.stripHint}>Touch pictures to talk</Text>}
          {sentence.map((w) => (
            <View key={w.id} style={styles.stripWord}>
              <Text style={styles.stripWordText}>{w.word}</Text>
            </View>
          ))}
        </ScrollView>
        <Pressable
          onPress={() => setSentence((s) => s.slice(0, -1))}
          disabled={!sentence.length}
          accessibilityRole="button"
          accessibilityLabel="Remove last word"
          style={[styles.stripButton, !sentence.length && styles.dim]}
        >
          <Ionicons name="backspace" size={30} color="#5B6475" />
        </Pressable>
        <Pressable onPress={sayIt} disabled={!sentence.length} accessibilityRole="button" accessibilityLabel="Say it" style={[styles.sayButton, !sentence.length && styles.dim]}>
          <Ionicons name="volume-high" size={28} color="#FFFFFF" />
          <Text style={styles.sayText}>Say it</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {CORE_WORDS.map((w) => (
          <Tile key={w.word} label={w.word} size={tile} colours={CLASS_COLOURS[w.cls]} onPress={() => add(w.word)}>
            <Ionicons name={w.icon} size={tile * 0.38} color="#1D2433" />
          </Tile>
        ))}
        {custom.map((b) => (
          <Tile key={b.id} label={b.label} size={tile} colours={CLASS_COLOURS.thing} onPress={() => add(b.label)}>
            <Image source={{ uri: b.photo }} style={{ width: tile * 0.56, height: tile * 0.56, borderRadius: 12 }} />
          </Tile>
        ))}
      </ScrollView>
    </View>
  );
}

function Tile({
  label,
  size,
  colours,
  onPress,
  children,
}: {
  label: string;
  size: number;
  colours: { fill: string; edge: string };
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size, backgroundColor: colours.fill, borderColor: colours.edge },
        pressed && { transform: [{ scale: 0.95 }] },
      ]}
    >
      {children}
      <Text style={[styles.tileLabel, { fontSize: Math.max(15, size * 0.15) }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#EEF3F9" },
  header: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 8 },
  close: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: 8 },
  closeText: { fontFamily: childFonts.bold, fontSize: 20, color: "#1D2433" },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
    minHeight: 84,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
    shadowColor: "rgba(29,36,51,0.08)",
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  stripWords: { alignItems: "center", gap: 8, paddingVertical: 12, flexGrow: 1 },
  stripHint: { fontFamily: childFonts.regular, fontSize: 18, color: "#9AA3B2" },
  stripWord: { backgroundColor: "#EEF3F9", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  stripWordText: { fontFamily: childFonts.bold, fontSize: 22, color: "#1D2433" },
  stripButton: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  sayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 64,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#0071E3",
  },
  sayText: { color: "#FFFFFF", fontFamily: childFonts.bold, fontSize: 20 },
  dim: { opacity: 0.35 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 32 },
  tile: { borderRadius: 22, borderWidth: 3, alignItems: "center", justifyContent: "center", padding: 6, gap: 4 },
  tileLabel: { fontFamily: childFonts.bold, color: "#1D2433", textAlign: "center" },
});
