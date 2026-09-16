/**
 * The "per-child comparison chart in the single-case style therapists
 * already read" (docs/PLAN.md Phase 4 acceptance test) — a grouped bar per
 * arm showing trials and accuracy, the current winner (if confirmed), and a
 * lock switch per arm (README §21: educator can override the AI).
 *
 * README §2B: these are explicitly labelled as internal model estimates,
 * never presented as ground truth.
 */
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { ArmEvidence, AxisEvidence, LockState } from "../shared/api";
import { colors, spacing } from "../shared/theme";
import { Card, ProgressBar, SectionLabel } from "../shared/ui";

export function AxisEvidenceCard({
  axis,
  locks,
  onToggleLock,
}: {
  axis: AxisEvidence;
  locks: LockState[];
  onToggleLock: (armCode: string, allow: boolean) => void;
}) {
  return (
    <Card>
      <View style={styles.headerRow}>
        <SectionLabel>{axis.axis_label}</SectionLabel>
        <Text style={styles.trialCount}>{axis.evidence_trials} trials</Text>
      </View>

      {axis.winner_confidence !== null ? (
        <Text style={styles.verdictText}>
          Current best option: confirmed (~{axis.winner_confidence}%{" "}
          {axis.axis_code === "intervention" ? "estimated engagement recovery" : "estimated success"})
        </Text>
      ) : (
        <Text style={styles.verdictTextMuted}>Still comparing — no confirmed winner yet</Text>
      )}

      {axis.arms.map((arm) => (
        <ArmRow
          key={arm.arm_code}
          arm={arm}
          statLabel={axis.axis_code === "intervention" ? "engagement recovery" : undefined}
          allowed={locks.find((l) => l.arm_code === arm.arm_code)?.allow ?? true}
          onToggle={(v) => onToggleLock(arm.arm_code, v)}
        />
      ))}

      <Text style={styles.footnote}>Internal model estimate, not a clinical measurement.</Text>
    </Card>
  );
}

function ArmRow({
  arm,
  allowed,
  onToggle,
  statLabel,
}: {
  arm: ArmEvidence;
  allowed: boolean;
  onToggle: (v: boolean) => void;
  statLabel?: string;
}) {
  return (
    <View style={styles.armRow}>
      <View style={styles.armHeader}>
        <Text style={styles.armLabel}>
          {arm.label} {arm.is_current_winner ? "🏆" : ""}
        </Text>
        <Text style={styles.armStats}>
          {arm.accuracy_percent}%{statLabel ? ` ${statLabel}` : ""} · n={arm.trials}
        </Text>
      </View>
      <ProgressBar percent={arm.accuracy_percent} color={arm.is_current_winner ? colors.success : colors.primary} />
      <View style={styles.lockRow}>
        <Text style={styles.lockLabel}>{allowed ? "Allowed" : "Blocked by educator"}</Text>
        <Switch value={allowed} onValueChange={onToggle} trackColor={{ true: colors.primary }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  trialCount: { fontSize: 12, color: colors.textSecondary },
  verdictText: { fontSize: 13, color: colors.success, fontWeight: "600", marginBottom: spacing.sm },
  verdictTextMuted: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  armRow: { marginBottom: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: "#F0E9DC" },
  armHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  armLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  armStats: { fontSize: 13, color: colors.textSecondary },
  lockRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  lockLabel: { fontSize: 12, color: colors.textSecondary },
  footnote: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs, fontStyle: "italic" },
});
