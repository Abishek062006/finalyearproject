/**
 * The detailed counsellor/teacher dashboard (README §2B) — more detail than
 * the parent view: raw domain percentages and per-arm evidence, both
 * explicitly labelled as internal model estimates.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, EducatorChildProfile, LockState } from "../shared/api";
import { colors, spacing } from "../shared/theme";
import { Card, ErrorText, ProgressBar, ScreenTitle, SecondaryButton, SectionLabel } from "../shared/ui";
import { AxisEvidenceCard } from "./AxisEvidenceCard";
import { TopicAssignCard } from "./TopicAssignCard";

export function EducatorDashboardScreen({ childId, onBack }: { childId: string; onBack: () => void }) {
  const [profile, setProfile] = useState<EducatorChildProfile | null>(null);
  const [locks, setLocks] = useState<LockState[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([api.educatorChildProfile(childId), api.educatorGetLocks(childId)]);
      setProfile(p);
      setLocks(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleLock(axisCode: string, armCode: string, allow: boolean) {
    setLocks((prev) => {
      const next = prev.filter((l) => !(l.axis_code === axisCode && l.arm_code === armCode));
      return [...next, { axis_code: axisCode, arm_code: armCode, allow }];
    });
    try {
      await api.educatorSetLock(childId, axisCode, armCode, allow);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      load();
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <ScreenTitle>Detailed Profile</ScreenTitle>
        <SecondaryButton title="← Back" onPress={onBack} />
      </View>

      <ErrorText>{error}</ErrorText>

      {profile === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Text style={styles.childName}>{profile.nickname}</Text>

          <Card>
            <SectionLabel>Learning (internal model estimates)</SectionLabel>
            {profile.domains.map((d) => (
              <View key={d.domain_code} style={styles.progressRow}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>{d.domain_label}</Text>
                  <Text style={styles.progressPercent}>{d.mastery_percent}%</Text>
                </View>
                <ProgressBar percent={d.mastery_percent} />
              </View>
            ))}
          </Card>

          <Text style={styles.sectionHeading}>Interaction &amp; teaching comparisons</Text>
          {profile.axes.map((axis) => (
            <AxisEvidenceCard
              key={axis.axis_code}
              axis={axis}
              locks={locks.filter((l) => axis.arms.some((a) => a.arm_code === l.arm_code))}
              onToggleLock={(armCode, allow) => toggleLock(axis.axis_code, armCode, allow)}
            />
          ))}

          <TopicAssignCard childId={childId} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 600, width: "100%", alignSelf: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  childName: { fontSize: 18, fontWeight: "700", color: colors.primaryDark, marginBottom: spacing.sm },
  progressRow: { marginBottom: spacing.sm },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  progressPercent: { fontSize: 15, fontWeight: "700", color: colors.primaryDark },
  sectionHeading: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.xs },
});
