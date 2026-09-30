/**
 * The parts of a child's progress both parents and educators see (plan
 * Phase 6): this week at a glance, a day-by-day chart, "what works" from
 * the engine's per-child findings, learning goals and session history.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Card, ListRow, ListSection, SegmentedControl, spacing, Text, useTheme } from "../design";
import { CareProgress, DailyPoint, SessionRecord, WhatWorks } from "../shared/api";
import { BarChart } from "./BarChart";

type Metric = "minutes" | "accuracy" | "breaks";

export function WeekTiles({ daily }: { daily: DailyPoint[] }) {
  const week = daily.slice(-7);
  const minutes = week.reduce((s, d) => s + d.minutes, 0);
  const activities = week.reduce((s, d) => s + d.activities, 0);
  const answers = week.reduce((s, d) => s + d.answers, 0);
  const correct = week.reduce((s, d) => s + (d.accuracy_percent !== null ? (d.accuracy_percent * d.answers) / 100 : 0), 0);
  const tiles = [
    { label: "Minutes learning", value: `${Math.round(minutes)}` },
    { label: "Activities", value: `${activities}` },
    { label: "Right answers", value: answers ? `${Math.round((100 * correct) / answers)}%` : "–" },
  ];
  return (
    <View style={styles.tiles}>
      {tiles.map((t) => (
        <Card key={t.label} style={styles.tile}>
          <Text variant="title2">{t.value}</Text>
          <Text variant="caption" tone="secondary">
            {t.label}
          </Text>
        </Card>
      ))}
    </View>
  );
}

export function DailyChart({ daily }: { daily: DailyPoint[] }) {
  const [metric, setMetric] = useState<Metric>("minutes");
  const days = daily.map((d) => d.day);
  const values =
    metric === "minutes" ? daily.map((d) => d.minutes) : metric === "accuracy" ? daily.map((d) => d.accuracy_percent) : daily.map((d) => d.breaks);
  const caption =
    metric === "minutes"
      ? "Minutes of learning each day."
      : metric === "accuracy"
        ? "Share of answers that were right, on days with learning."
        : "Times your child asked for a break themselves.";
  return (
    <Card>
      <SegmentedControl
        options={[
          { value: "minutes", label: "Minutes" },
          { value: "accuracy", label: "Right answers" },
          { value: "breaks", label: "Breaks" },
        ]}
        value={metric}
        onChange={setMetric}
      />
      <View style={{ height: spacing.md }} />
      <BarChart days={days} values={values} unit={metric === "accuracy" ? "%" : ""} max={metric === "accuracy" ? 100 : undefined} />
      <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.xs }}>
        {caption} Last {daily.length} days; today is the bright bar.
      </Text>
    </Card>
  );
}

export function WhatWorksSection({ items, childName }: { items: WhatWorks[]; childName: string }) {
  const { colors } = useTheme();
  return (
    <ListSection
      header={`What works for ${childName}`}
      footer="AURA tries each way on purpose and only calls one better once the difference is clear for this child."
    >
      {items.map((w, i) => (
        <View key={w.axis_code} style={[styles.works, i < items.length - 1 && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <Ionicons name={w.confirmed ? "checkmark-circle" : "hourglass-outline"} size={22} color={w.confirmed ? colors.success : colors.labelTertiary} />
          <View style={{ flex: 1 }}>
            <Text variant="footnote" tone="secondary">
              {w.question}
            </Text>
            <Text variant="headline">{w.answer}</Text>
            <Text variant="footnote" tone="secondary">
              {w.detail}
            </Text>
          </View>
        </View>
      ))}
    </ListSection>
  );
}

const END_REASON: Record<string, string> = {
  child_all_done: "Ended by your child",
  grown_up: "Ended by a grown-up",
  completed: "Finished",
};

export function SessionsSection({ sessions }: { sessions: SessionRecord[] }) {
  if (!sessions.length) return null;
  return (
    <ListSection header="Recent sessions">
      {sessions.slice(0, 8).map((s) => {
        const d = new Date(s.started_at);
        const when = `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
        const parts = [`${Math.round(s.minutes)} min`, s.accuracy_percent !== null ? `${s.accuracy_percent}% right` : null, s.breaks ? `${s.breaks} break${s.breaks > 1 ? "s" : ""}` : null].filter(Boolean);
        return (
          <ListRow
            key={s.id}
            title={when}
            subtitle={[s.topics.join(", "), s.end_reason ? END_REASON[s.end_reason] : "Still open"].filter(Boolean).join(" · ")}
            value={parts.join(" · ")}
          />
        );
      })}
    </ListSection>
  );
}

export function Overview({ progress, childName }: { progress: CareProgress; childName: string }) {
  return (
    <>
      <WeekTiles daily={progress.daily} />
      <DailyChart daily={progress.daily} />
      <WhatWorksSection items={progress.what_works} childName={childName} />
    </>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: spacing.sm },
  tile: { flex: 1, gap: 2 },
  works: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: "flex-start" },
});
