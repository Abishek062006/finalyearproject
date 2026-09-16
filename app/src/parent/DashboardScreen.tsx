/**
 * README §2A items 4-14. Understandable terms only: "Learning Progress",
 * "Topics to Review", "Today's Suggestions" — no raw model internals (that
 * level of detail is the educator dashboard's job, docs/PLAN.md Phase 4).
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ChildSummary } from "../shared/api";
import { colors, spacing } from "../shared/theme";
import { Card, ErrorText, ProgressBar, ScreenTitle, SecondaryButton, SectionLabel } from "../shared/ui";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function DashboardScreen({ childId, onBack, onOpenConsent }: { childId: string; onBack: () => void; onOpenConsent: () => void }) {
  const [summary, setSummary] = useState<ChildSummary | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setSummary(await api.childSummary(childId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(recommendationId: string, response: "accepted" | "skipped") {
    await api.respondToRecommendation(recommendationId, response);
    load();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <ScreenTitle>Learning Progress</ScreenTitle>
        <SecondaryButton title="← Back" onPress={onBack} />
      </View>

      <ErrorText>{error}</ErrorText>

      {summary === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <View style={styles.statRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{Math.round(summary.learning_minutes_total)}</Text>
              <Text style={styles.statLabel}>Minutes learning</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{summary.activities_completed}</Text>
              <Text style={styles.statLabel}>Activities completed</Text>
            </Card>
          </View>

          <Card>
            <SectionLabel>Progress by area</SectionLabel>
            {summary.domains.map((d) => (
              <View key={d.domain_code} style={styles.progressRow}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>{d.domain_label}</Text>
                  <Text style={styles.progressPercent}>{d.mastery_percent}%</Text>
                </View>
                <ProgressBar percent={d.mastery_percent} />
              </View>
            ))}
          </Card>

          <Card>
            <SectionLabel>Today's suggestions</SectionLabel>
            {summary.todays_suggestions.length === 0 ? (
              <Text style={styles.mutedText}>Nothing new to suggest today.</Text>
            ) : (
              summary.todays_suggestions.map((rec) => (
                <View key={rec.id} style={styles.suggestionRow}>
                  <Text style={styles.suggestionText}>{rec.payload.message ?? rec.payload.topic_label}</Text>
                  {rec.response ? (
                    <Text style={styles.mutedText}>{rec.response === "accepted" ? "Accepted ✓" : "Skipped"}</Text>
                  ) : (
                    <View style={styles.suggestionButtons}>
                      <Pressable onPress={() => respond(rec.id, "accepted")} style={styles.acceptButton}>
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </Pressable>
                      <Pressable onPress={() => respond(rec.id, "skipped")} style={styles.skipButton}>
                        <Text style={styles.skipButtonText}>Skip</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </Card>

          <Card>
            <SectionLabel>Topics to review</SectionLabel>
            {summary.topics_to_review.length === 0 ? (
              <Text style={styles.mutedText}>Nothing needs review right now.</Text>
            ) : (
              summary.topics_to_review.map((t) => (
                <View key={t.topic_id} style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>{t.topic_label}</Text>
                  <Text style={styles.reviewPercent}>{t.mastery_percent}%</Text>
                </View>
              ))
            )}
          </Card>

          <Card>
            <SectionLabel>Session history</SectionLabel>
            {summary.recent_sessions.length === 0 ? (
              <Text style={styles.mutedText}>No sessions yet.</Text>
            ) : (
              summary.recent_sessions.map((s) => (
                <View key={s.id} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{formatDate(s.started_at)}</Text>
                  <Text style={styles.mutedText}>{s.actual_minutes ? `${Math.round(s.actual_minutes)} min` : "in progress"}</Text>
                </View>
              ))
            )}
          </Card>

          <SecondaryButton title="Privacy & camera settings" onPress={onOpenConsent} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 560, width: "100%", alignSelf: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statRow: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 32, fontWeight: "800", color: colors.primaryDark },
  statLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: "center" },
  progressRow: { marginBottom: spacing.sm },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  progressPercent: { fontSize: 15, fontWeight: "700", color: colors.primaryDark },
  mutedText: { color: colors.textSecondary, fontSize: 14 },
  suggestionRow: { paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: "#F0E9DC" },
  suggestionText: { fontSize: 15, color: colors.textPrimary, marginBottom: 8 },
  suggestionButtons: { flexDirection: "row", gap: spacing.sm },
  acceptButton: { backgroundColor: colors.success, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16 },
  acceptButtonText: { color: "#fff", fontWeight: "700" },
  skipButton: { paddingVertical: 8, paddingHorizontal: 16 },
  skipButtonText: { color: colors.textSecondary, fontWeight: "600" },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  reviewLabel: { fontSize: 15, color: colors.textPrimary },
  reviewPercent: { fontSize: 15, fontWeight: "700", color: colors.primaryDark },
  historyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  historyDate: { fontSize: 14, color: colors.textPrimary },
});
