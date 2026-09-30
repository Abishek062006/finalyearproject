/**
 * The parent's view of a child's progress (plan Phase 6), in three parts:
 *
 * - Overview: this week, a day-by-day chart (Apple Health style), what works
 *   for this child, goals, progress by area, suggestions, sessions — and a
 *   report to share with a therapist.
 * - Journal: the family's daily log of sleep, mood and notable moments.
 * - Notes: shared with the child's linked teachers and therapists.
 *
 * Plain words throughout; the raw model internals stay on the educator side.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Card, ListRow, ListSection, ListSwitch, Screen, SegmentedControl, spacing, Text, useTheme } from "../design";
import { GoalsSection } from "../care/GoalsSection";
import { JournalSection } from "../care/JournalSection";
import { NotesSection } from "../care/NotesSection";
import { Overview, SessionsSection } from "../care/OverviewSections";
import { buildReportHtml, shareReport } from "../care/report";
import { api, CareProgress, Child, ChildSummary } from "../shared/api";
import { InviteEducatorCard } from "./InviteEducatorCard";

type Tab = "overview" | "journal" | "notes";

export function DashboardScreen({ childId, onBack, onOpenConsent }: { childId: string; onBack: () => void; onOpenConsent: () => void }) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("overview");
  const [child, setChild] = useState<Child | null>(null);
  const [progress, setProgress] = useState<CareProgress | null>(null);
  const [summary, setSummary] = useState<ChildSummary | null>(null);
  const [error, setError] = useState("");
  const [includeJournal, setIncludeJournal] = useState(true);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p, s] = await Promise.all([api.getChild(childId), api.careProgress(childId, 14), api.childSummary(childId)]);
      setChild(c);
      setProgress(p);
      setSummary(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function report() {
    if (!progress || !child) return;
    setReporting(true);
    try {
      const [journal, notes] = await Promise.all([includeJournal ? api.journal(childId) : Promise.resolve(null), api.notes(childId)]);
      await shareReport(buildReportHtml({ childName: child.nickname, progress, journal, notes }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReporting(false);
    }
  }

  async function respond(recommendationId: string, response: "accepted" | "skipped") {
    await api.respondToRecommendation(recommendationId, response);
    load();
  }

  const name = child?.nickname ?? "your child";

  return (
    <Screen title="Progress" onBack={onBack} backLabel="Today">
      <SegmentedControl
        options={[
          { value: "overview", label: "Overview" },
          { value: "journal", label: "Journal" },
          { value: "notes", label: "Notes" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <View style={{ height: spacing.md }} />

      {!!error && (
        <Text variant="footnote" tone="destructive" style={{ marginBottom: spacing.sm }}>
          {error}
        </Text>
      )}

      {!progress || !summary || !child ? (
        <ActivityIndicator color={colors.tint} />
      ) : tab === "journal" ? (
        <JournalSection childId={childId} insight={progress.sleep_insight} />
      ) : tab === "notes" ? (
        <NotesSection childId={childId} />
      ) : (
        <>
          <Overview progress={progress} childName={name} />

          {summary.recommended_session_minutes !== null && (
            <Card>
              <Text variant="headline">Suggested time today</Text>
              <Text variant="body" style={{ marginTop: 4 }}>
                About {Math.round(summary.recommended_session_minutes)} minutes — based on how long {name} has stayed engaged recently.
              </Text>
            </Card>
          )}

          <GoalsSection childId={childId} childName={name} goals={progress.goals} onChanged={load} />

          <ListSection header="Progress by area">
            {summary.domains.map((d) => (
              <View key={d.domain_code} style={styles.areaRow}>
                <View style={styles.areaTop}>
                  <Text variant="body">{d.domain_label}</Text>
                  <Text variant="body" tone="secondary">
                    {d.mastery_percent}%
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: colors.fill }]}>
                  <View style={[styles.fill, { width: `${d.mastery_percent}%`, backgroundColor: colors.tint }]} />
                </View>
              </View>
            ))}
          </ListSection>

          {summary.topics_to_review.length > 0 && (
            <ListSection header="Worth revisiting" footer="Remembered less well since it was last practised — AURA brings these back on its own.">
              {summary.topics_to_review.map((t) => (
                <ListRow key={t.topic_id} title={t.topic_label} value={`${t.retention_percent}% remembered`} />
              ))}
            </ListSection>
          )}

          {summary.todays_suggestions.length > 0 && (
            <ListSection header="Today's suggestions">
              {summary.todays_suggestions.map((rec) => (
                <View key={rec.id} style={styles.suggestion}>
                  <Text variant="body">{rec.payload.message ?? rec.payload.topic_label}</Text>
                  {rec.response ? (
                    <Text variant="footnote" tone="secondary">
                      {rec.response === "accepted" ? "Accepted" : "Skipped"}
                    </Text>
                  ) : (
                    <View style={styles.suggestionButtons}>
                      <Button title="Accept" size="medium" onPress={() => respond(rec.id, "accepted")} />
                      <Button title="Skip" size="medium" variant="plain" onPress={() => respond(rec.id, "skipped")} />
                    </View>
                  )}
                </View>
              ))}
            </ListSection>
          )}

          <SessionsSection sessions={progress.sessions} />

          <ListSection header="Share with a therapist or teacher" footer="A one-page summary of the last two weeks. You choose where it goes.">
            <ListRow title="Include the family journal" accessory={<ListSwitch value={includeJournal} onValueChange={setIncludeJournal} />} />
          </ListSection>
          <Button title="Create report" icon="document-text" onPress={report} loading={reporting} />
          <View style={{ height: spacing.lg }} />

          <InviteEducatorCard childId={childId} />

          <ListSection>
            <ListRow title="Privacy & sharing" icon="lock-closed" iconColor="#8E8E93" accessory="chevron" onPress={onOpenConsent} />
          </ListSection>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  areaRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 },
  areaTop: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  suggestion: { padding: spacing.md, gap: spacing.xs },
  suggestionButtons: { flexDirection: "row", gap: spacing.sm },
});
