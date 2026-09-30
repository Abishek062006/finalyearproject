/**
 * One comparison AURA is running for this child (teaching method, response
 * mode, theme, re-engagement support), drawn the way single-case researchers
 * and therapists read evidence: each option's estimated success as a dot,
 * with its 95% credible interval as a bar — a forest plot. Non-overlapping
 * intervals are what lets AURA call a winner. Each option has a switch so
 * the educator can block it (README §21: the educator can overrule the AI).
 *
 * README §2B: labelled as internal estimates, never as clinical measurement.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Card, ListSwitch, spacing, Text, useTheme } from "../design";
import { ArmEvidence, AxisEvidence, LockState } from "../shared/api";

export function AxisEvidenceCard({
  axis,
  locks,
  onToggleLock,
}: {
  axis: AxisEvidence;
  locks: LockState[];
  onToggleLock: (armCode: string, allow: boolean) => void;
}) {
  const recovery = axis.axis_code === "intervention";
  return (
    <Card>
      <View style={styles.header}>
        <Text variant="headline">{axis.axis_label}</Text>
        <Text variant="footnote" tone="secondary">
          {axis.evidence_trials} trials
        </Text>
      </View>
      <Text variant="footnote" tone={axis.winner_confidence !== null ? "success" : "secondary"} style={{ marginBottom: spacing.sm }}>
        {axis.winner_confidence !== null ? "Confirmed: one option is clearly better for this child." : "Still comparing — the ranges still overlap."}
      </Text>
      <Scale />
      {axis.arms.map((arm) => (
        <ArmRow
          key={arm.arm_code}
          arm={arm}
          allowed={locks.find((l) => l.arm_code === arm.arm_code)?.allow ?? true}
          onToggle={(v) => onToggleLock(arm.arm_code, v)}
        />
      ))}
      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
        Dot: estimated {recovery ? "engagement recovery" : "success"}. Bar: 95% range. Internal model estimate, not a clinical measurement.
      </Text>
    </Card>
  );
}

function Scale() {
  return (
    <View style={styles.scaleRow}>
      <View style={styles.labelCol} />
      <View style={styles.plotCol}>
        <View style={styles.scaleLabels}>
          {["0%", "50%", "100%"].map((l) => (
            <Text key={l} variant="caption" tone="tertiary">
              {l}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.switchCol} />
    </View>
  );
}

function ArmRow({ arm, allowed, onToggle }: { arm: ArmEvidence; allowed: boolean; onToggle: (v: boolean) => void }) {
  const { colors } = useTheme();
  const colour = !allowed ? colors.labelTertiary : arm.is_current_winner ? colors.success : colors.tint;
  const tried = arm.trials > 0;
  return (
    <View style={[styles.row, !allowed && { opacity: 0.55 }]}>
      <View style={styles.labelCol}>
        <Text variant="subhead" numberOfLines={1}>
          {arm.label}
          {arm.is_current_winner ? " ✓" : ""}
        </Text>
        <Text variant="caption" tone="secondary">
          {tried ? `${arm.accuracy_percent}% · n=${arm.trials}` : "not tried yet"}
          {!allowed ? " · blocked" : ""}
        </Text>
      </View>
      <View style={styles.plotCol} accessibilityLabel={`${arm.label}: ${arm.accuracy_percent}%, range ${arm.ci_low_percent} to ${arm.ci_high_percent}%`}>
        <View style={[styles.axis, { backgroundColor: colors.separator }]} />
        <View style={[styles.mid, { backgroundColor: colors.separator }]} />
        {tried && (
          <>
            <View style={[styles.interval, { left: `${arm.ci_low_percent}%`, width: `${Math.max(1, arm.ci_high_percent - arm.ci_low_percent)}%`, backgroundColor: colour }]} />
            <View style={[styles.dot, { left: `${arm.accuracy_percent}%`, backgroundColor: colour, borderColor: colors.surface }]} />
          </>
        )}
      </View>
      <View style={styles.switchCol}>
        <ListSwitch value={allowed} onValueChange={onToggle} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  scaleRow: { flexDirection: "row", alignItems: "center" },
  scaleLabels: { flexDirection: "row", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  labelCol: { width: 128, paddingRight: spacing.sm },
  plotCol: { flex: 1, height: 28, justifyContent: "center" },
  switchCol: { width: 64, alignItems: "flex-end" },
  axis: { position: "absolute", left: 0, right: 0, height: 1 },
  mid: { position: "absolute", left: "50%", width: 1, top: 4, bottom: 4 },
  interval: { position: "absolute", height: 6, borderRadius: 3, opacity: 0.35 },
  dot: { position: "absolute", width: 14, height: 14, borderRadius: 7, marginLeft: -7, borderWidth: 2 },
});
