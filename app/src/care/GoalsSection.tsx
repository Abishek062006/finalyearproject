/**
 * IEP-style learning goals: one topic, a target accuracy, and how many
 * sessions in a row. Progress comes from the child's real answers; a goal
 * marks itself met. Parents and educators can both add goals and pause them.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Chip, haptic, ListSection, radius, SegmentedControl, spacing, Text, useTheme } from "../design";
import { api, CareTopic, LearningGoal } from "../shared/api";

const STATUS_LABEL = { active: "In progress", met: "Met", paused: "Paused" } as const;

export function GoalsSection({ childId, childName, goals, onChanged }: { childId: string; childName: string; goals: LearningGoal[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <ListSection header="Learning goals" footer="Measured from real answers. A goal is met when the target is reached in enough sessions in a row.">
      {goals.length === 0 && !adding && (
        <Text variant="body" tone="secondary" style={styles.empty}>
          No goals yet.
        </Text>
      )}
      {goals.map((g) => (
        <GoalRow key={g.id} goal={g} onToggle={async () => {
          await api.setGoalStatus(childId, g.id, g.status === "paused" ? "active" : "paused");
          onChanged();
        }} />
      ))}
      {adding ? (
        <GoalForm
          childId={childId}
          childName={childName}
          onDone={(saved) => {
            setAdding(false);
            if (saved) onChanged();
          }}
        />
      ) : (
        <Pressable onPress={() => setAdding(true)} accessibilityRole="button" style={styles.addRow}>
          <Ionicons name="add-circle" size={22} color="#0A84FF" />
          <Text variant="body" tone="tint">
            Add a goal
          </Text>
        </Pressable>
      )}
    </ListSection>
  );
}

function GoalRow({ goal, onToggle }: { goal: LearningGoal; onToggle: () => void }) {
  const { colors } = useTheme();
  const tint = goal.status === "met" ? colors.success : goal.status === "paused" ? colors.labelTertiary : colors.tint;
  return (
    <View style={[styles.goal, { borderBottomColor: colors.separator }]}>
      <View style={styles.goalTop}>
        <Text variant="caption" style={{ color: tint, fontWeight: "700" }}>
          {STATUS_LABEL[goal.status].toUpperCase()} · {goal.topic_label}
        </Text>
        {goal.status !== "met" && (
          <Pressable onPress={onToggle} accessibilityRole="button" hitSlop={8}>
            <Text variant="footnote" tone="tint">
              {goal.status === "paused" ? "Resume" : "Pause"}
            </Text>
          </Pressable>
        )}
      </View>
      <Text variant="body">{goal.statement}</Text>
      <View style={styles.dots} accessibilityLabel={`${goal.sessions_in_a_row} of ${goal.target_sessions} sessions in a row`}>
        {Array.from({ length: goal.target_sessions }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < goal.sessions_in_a_row ? tint : colors.fill }]} />
        ))}
        <Text variant="footnote" tone="secondary" style={{ marginLeft: spacing.xs }}>
          {goal.sessions_in_a_row} of {goal.target_sessions} in a row
          {goal.recent_accuracies.length ? ` · recent: ${goal.recent_accuracies.slice(-4).map((a) => `${a}%`).join(", ")}` : ""}
        </Text>
      </View>
    </View>
  );
}

function GoalForm({ childId, childName, onDone }: { childId: string; childName: string; onDone: (saved: boolean) => void }) {
  const [topics, setTopics] = useState<CareTopic[]>([]);
  const [topic, setTopic] = useState<CareTopic | null>(null);
  const [accuracy, setAccuracy] = useState("80");
  const [sessions, setSessions] = useState("3");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.careTopics(childId).then(setTopics).catch((e) => setError(String(e)));
  }, [childId]);

  async function save() {
    if (!topic) return;
    setSaving(true);
    try {
      await api.addGoal(childId, { topic_code: topic.code, target_accuracy: Number(accuracy), target_sessions: Number(sessions) });
      haptic("success");
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text variant="footnote" tone="secondary">
        What should the goal be about?
      </Text>
      <View style={styles.chips}>
        {topics.map((t) => (
          <Chip key={t.code} label={t.label} selected={topic?.code === t.code} onPress={() => setTopic(t)} />
        ))}
      </View>
      <Text variant="footnote" tone="secondary">
        Right answers needed
      </Text>
      <SegmentedControl options={["70", "80", "90"].map((v) => ({ value: v, label: `${v}%` }))} value={accuracy} onChange={setAccuracy} />
      <Text variant="footnote" tone="secondary">
        Sessions in a row
      </Text>
      <SegmentedControl options={["2", "3", "5"].map((v) => ({ value: v, label: v }))} value={sessions} onChange={setSessions} />
      {topic && (
        <View style={styles.preview}>
          <Text variant="callout">
            {childName} will answer {accuracy}% correctly in {topic.label}, in {sessions} sessions in a row.
          </Text>
        </View>
      )}
      {!!error && (
        <Text variant="footnote" tone="destructive">
          {error}
        </Text>
      )}
      <Button title="Add goal" onPress={save} loading={saving} disabled={!topic} />
      <Button title="Cancel" variant="plain" onPress={() => onDone(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { padding: spacing.md },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  goal: { padding: spacing.md, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  goalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dots: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" },
  dot: { width: 14, height: 14, borderRadius: 7 },
  form: { padding: spacing.md, gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  preview: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: "rgba(10,132,255,0.08)" },
});
