/**
 * The family journal (like Birdhouse): a quick daily log of sleep, mood and
 * anything notable. Once there are enough days it lines sleep up against
 * learning — shown as a pattern to watch, never as a conclusion.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Chip, haptic, ListRow, ListSection, spacing, Text, TextField, useTheme } from "../design";
import { api, JOURNAL_TAGS, JournalEntry, SleepInsight } from "../shared/api";

const MOODS = [
  { value: 1, icon: "sad", label: "Very hard day" },
  { value: 2, icon: "sad-outline", label: "Hard day" },
  { value: 3, icon: "remove-circle-outline", label: "Okay day" },
  { value: 4, icon: "happy-outline", label: "Good day" },
  { value: 5, icon: "happy", label: "Great day" },
] as const;

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function JournalSection({ childId, insight }: { childId: string; insight: SleepInsight | null }) {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const today = localDay();
  const [sleep, setSleep] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const list = await api.journal(childId).catch(() => []);
    setEntries(list);
    const mine = list.find((e) => e.day === today);
    if (mine) {
      setSleep(mine.sleep_hours);
      setMood(mine.mood);
      setTags(mine.tags);
      setNote(mine.note);
    }
  }, [childId, today]);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      await api.saveJournal(childId, { day: today, sleep_hours: sleep, mood, tags, note });
      haptic("success");
      setSaved(true);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const stepSleep = (by: number) => setSleep((s) => Math.max(0, Math.min(18, (s ?? 9) + by)));

  return (
    <View>
      <Card>
        <Text variant="headline">How was today?</Text>

        <Text variant="footnote" tone="secondary" style={styles.label}>
          Sleep last night
        </Text>
        <View style={styles.stepper}>
          <Pressable onPress={() => stepSleep(-0.5)} accessibilityRole="button" accessibilityLabel="Less sleep" style={[styles.stepButton, { backgroundColor: colors.fill }]}>
            <Ionicons name="remove" size={22} color={colors.label} />
          </Pressable>
          <Text variant="title2" style={styles.sleepValue}>
            {sleep === null ? "–" : `${sleep} h`}
          </Text>
          <Pressable onPress={() => stepSleep(0.5)} accessibilityRole="button" accessibilityLabel="More sleep" style={[styles.stepButton, { backgroundColor: colors.fill }]}>
            <Ionicons name="add" size={22} color={colors.label} />
          </Pressable>
        </View>

        <Text variant="footnote" tone="secondary" style={styles.label}>
          Mood
        </Text>
        <View style={styles.moods}>
          {MOODS.map((m) => (
            <Pressable
              key={m.value}
              onPress={() => setMood(m.value)}
              accessibilityRole="button"
              accessibilityLabel={m.label}
              aria-selected={mood === m.value}
              style={[styles.mood, { backgroundColor: mood === m.value ? colors.tint : colors.fill }]}
            >
              <Ionicons name={m.icon} size={26} color={mood === m.value ? colors.onTint : colors.label} />
            </Pressable>
          ))}
        </View>

        <Text variant="footnote" tone="secondary" style={styles.label}>
          Anything notable?
        </Text>
        <View style={styles.tags}>
          {JOURNAL_TAGS.map((t) => (
            <Chip key={t.code} label={t.label} selected={tags.includes(t.code)} onPress={() => setTags((ts) => (ts.includes(t.code) ? ts.filter((x) => x !== t.code) : [...ts, t.code]))} />
          ))}
        </View>
        <TextField placeholder="A few words (optional)" value={note} onChangeText={setNote} multiline maxLength={1000} />
        <Button title={saved ? "Saved ✓" : "Save today"} onPress={save} loading={saving} />
      </Card>

      {insight ? (
        <Card>
          <Text variant="headline">Sleep and learning</Text>
          <Text variant="body" style={{ marginTop: 4 }}>
            {insight.text}
          </Text>
        </Card>
      ) : (
        <Text variant="footnote" tone="secondary" style={styles.hint}>
          After a couple of weeks of entries, you'll see how sleep lines up with learning here.
        </Text>
      )}

      {entries.length > 0 && (
        <ListSection header="Earlier days">
          {entries.slice(0, 14).map((e) => (
            <ListRow
              key={e.id}
              title={new Date(`${e.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              subtitle={[e.tags.map((t) => JOURNAL_TAGS.find((x) => x.code === t)?.label ?? t).join(", "), e.note].filter(Boolean).join(" — ")}
              value={[e.sleep_hours !== null ? `${e.sleep_hours} h` : null, e.mood ? MOODS[e.mood - 1].label : null].filter(Boolean).join(" · ")}
            />
          ))}
        </ListSection>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: spacing.md, marginBottom: spacing.xs },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sleepValue: { minWidth: 72, textAlign: "center" },
  moods: { flexDirection: "row", gap: spacing.sm },
  mood: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  hint: { marginHorizontal: spacing.md, marginBottom: spacing.md },
});
