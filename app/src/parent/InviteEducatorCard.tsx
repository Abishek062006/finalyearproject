/**
 * README §21: parents can grant a teacher/counsellor access to the detailed
 * dashboard. The educator must already have an AURA account with role
 * "educator" — this links, it doesn't send an email invite (docs/PLAN.md
 * Phase 4 is a research prototype, not a full identity system).
 */
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api, EducatorLinkInfo } from "../shared/api";
import { colors, spacing } from "../shared/theme";
import { Card, ErrorText, LabeledInput, PrimaryButton, SectionLabel } from "../shared/ui";

export function InviteEducatorCard({ childId }: { childId: string }) {
  const [educators, setEducators] = useState<EducatorLinkInfo[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setEducators(await api.getEducators(childId));
    } catch {
      // non-fatal — just leave the list empty
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.linkEducator(childId, email.trim());
      setEmail("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <SectionLabel>Teacher or counsellor access</SectionLabel>
      {educators.length > 0 && (
        <View style={styles.list}>
          {educators.map((e) => (
            <Text key={e.id} style={styles.educatorRow}>
              {e.display_name} · {e.email}
            </Text>
          ))}
        </View>
      )}
      <LabeledInput label="Their AURA account email" value={email} onChangeText={setEmail} placeholder="teacher@school.example" />
      <ErrorText>{error}</ErrorText>
      <PrimaryButton title="Grant access" onPress={submit} loading={loading} />
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { marginBottom: spacing.sm },
  educatorRow: { fontSize: 14, color: colors.textPrimary, marginBottom: 4 },
});
