/**
 * README §2B item 18 / §21: "Manually assign or recommend activities."
 * SessionPlanner honors this for up to 24 hours (app/services/educator_service.py).
 */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api, Topic } from "../shared/api";
import { colors, spacing } from "../shared/theme";
import { Card, SectionLabel } from "../shared/ui";

export function TopicAssignCard({ childId }: { childId: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [assignedCode, setAssignedCode] = useState<string | null>(null);

  useEffect(() => {
    api.educatorListTopics().then(setTopics).catch(() => {});
  }, []);

  async function assign(code: string) {
    await api.educatorAssignTopic(childId, code);
    setAssignedCode(code);
  }

  return (
    <Card>
      <SectionLabel>Assign a topic</SectionLabel>
      <Text style={styles.description}>Overrides the AI's own choice for the next 24 hours.</Text>
      <View style={styles.chipRow}>
        {topics.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => assign(t.code)}
            style={[styles.chip, assignedCode === t.code && styles.chipAssigned]}
          >
            <Text style={[styles.chipText, assignedCode === t.code && styles.chipTextAssigned]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {assignedCode && <Text style={styles.confirmText}>Assigned ✓ — the child will see this next.</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  description: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: "#E5DDD1", borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#fff" },
  chipAssigned: { backgroundColor: colors.success, borderColor: colors.success },
  chipText: { fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
  chipTextAssigned: { color: "#fff" },
  confirmText: { fontSize: 13, color: colors.success, marginTop: spacing.sm, fontWeight: "600" },
});
