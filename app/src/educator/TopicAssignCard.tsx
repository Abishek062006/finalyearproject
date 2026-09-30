/**
 * README §2B item 18 / §21: "Manually assign or recommend activities."
 * SessionPlanner honours this for up to 24 hours (app/services/educator_service.py).
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Card, Chip, haptic, spacing, Text } from "../design";
import { api, Topic } from "../shared/api";

export function TopicAssignCard({ childId }: { childId: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [assignedCode, setAssignedCode] = useState<string | null>(null);

  useEffect(() => {
    api.educatorListTopics().then(setTopics).catch(() => {});
  }, []);

  async function assign(code: string) {
    await api.educatorAssignTopic(childId, code);
    haptic("success");
    setAssignedCode(code);
  }

  return (
    <Card>
      <Text variant="headline">Practise next</Text>
      <Text variant="footnote" tone="secondary" style={styles.description}>
        Chooses the topic for the next 24 hours instead of AURA. Everything else (teaching method, pictures, safety) still adapts as usual.
      </Text>
      <View style={styles.chips}>
        {topics.map((t) => (
          <Chip key={t.id} label={t.label} selected={assignedCode === t.code} onPress={() => assign(t.code)} />
        ))}
      </View>
      {assignedCode && (
        <Text variant="footnote" tone="success" style={{ marginTop: spacing.sm }}>
          Assigned — it comes up next.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  description: { marginTop: 2, marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
