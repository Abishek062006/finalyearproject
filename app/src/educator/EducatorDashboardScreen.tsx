/**
 * The teacher / therapist view of one student (README §2B, plan Phase 6).
 * More detail than the parent view — the engine's evidence per comparison,
 * with switches to block an option — plus the shared parts: progress over
 * time, IEP-style goals and notes. The family journal is not shown here.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ListSection, Screen, SegmentedControl, spacing, Text, useTheme } from "../design";
import { GoalsSection } from "../care/GoalsSection";
import { NotesSection } from "../care/NotesSection";
import { DailyChart, SessionsSection, WeekTiles, WhatWorksSection } from "../care/OverviewSections";
import { api, CareProgress, EducatorChildProfile, LockState } from "../shared/api";
import { AxisEvidenceCard } from "./AxisEvidenceCard";
import { TopicAssignCard } from "./TopicAssignCard";

type Tab = "overview" | "evidence" | "goals" | "notes";

export function EducatorDashboardScreen({ childId, onBack }: { childId: string; onBack: () => void }) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<EducatorChildProfile | null>(null);
  const [progress, setProgress] = useState<CareProgress | null>(null);
  const [locks, setLocks] = useState<LockState[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, pr, l] = await Promise.all([api.educatorChildProfile(childId), api.careProgress(childId, 14), api.educatorGetLocks(childId)]);
      setProfile(p);
      setProgress(pr);
      setLocks(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleLock(axisCode: string, armCode: string, allow: boolean) {
    setLocks((prev) => [...prev.filter((l) => !(l.axis_code === axisCode && l.arm_code === armCode)), { axis_code: axisCode, arm_code: armCode, allow }]);
    try {
      await api.educatorSetLock(childId, axisCode, armCode, allow);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      load();
    }
  }

  return (
    <Screen title={profile?.nickname ?? "Student"} onBack={onBack} backLabel="Students">
      <SegmentedControl
        options={[
          { value: "overview", label: "Overview" },
          { value: "evidence", label: "Evidence" },
          { value: "goals", label: "Goals" },
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

      {!profile || !progress ? (
        <ActivityIndicator color={colors.tint} />
      ) : tab === "evidence" ? (
        <>
          <Text variant="footnote" tone="secondary" style={styles.intro}>
            AURA varies each of these on purpose within {profile.nickname}'s own sessions. Block any option you don't want used.
          </Text>
          {profile.axes.map((axis) => (
            <AxisEvidenceCard
              key={axis.axis_code}
              axis={axis}
              locks={locks.filter((l) => l.axis_code === axis.axis_code)}
              onToggleLock={(armCode, allow) => toggleLock(axis.axis_code, armCode, allow)}
            />
          ))}
        </>
      ) : tab === "goals" ? (
        <GoalsSection childId={childId} childName={profile.nickname} goals={progress.goals} onChanged={load} />
      ) : tab === "notes" ? (
        <NotesSection childId={childId} />
      ) : (
        <>
          <WeekTiles daily={progress.daily} />
          <DailyChart daily={progress.daily} />
          <WhatWorksSection items={progress.what_works} childName={profile.nickname} />
          <TopicAssignCard childId={childId} />
          <ListSection header="Mastery by area (model estimate)">
            {profile.domains.map((d) => (
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
          <SessionsSection sessions={progress.sessions} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.md, marginHorizontal: spacing.xxs },
  areaRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 },
  areaTop: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
