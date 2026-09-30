/**
 * Notes shared between a child's parents and teachers/therapists — what was
 * tried, what happened, what to try next. Newest first.
 */
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, haptic, spacing, Text, TextField } from "../design";
import { api, CareNote } from "../shared/api";

export function NotesSection({ childId }: { childId: string }) {
  const [notes, setNotes] = useState<CareNote[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.notes(childId).then(setNotes).catch(() => {}), [childId]);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.addNote(childId, text.trim());
      haptic("success");
      setText("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Card>
        <TextField label="Add a note" placeholder="What happened, what helped, what to try next" value={text} onChangeText={setText} multiline maxLength={1000} />
        <Button title="Share note" onPress={add} loading={saving} disabled={!text.trim()} />
        <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.xs }}>
          Everyone who supports this child here can read notes.
        </Text>
      </Card>
      {notes.map((n) => (
        <Card key={n.id}>
          <Text variant="caption" tone="secondary">
            {n.author_name} · {n.author_role === "educator" ? "Educator" : "Parent"} · {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </Text>
          <Text variant="body" style={styles.noteText}>
            {n.text}
          </Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  noteText: { marginTop: 4 },
});
