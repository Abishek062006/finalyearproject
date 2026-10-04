/**
 * README §18 (Camera privacy) + §2A items 15-17. Consent is append-only on
 * the backend (docs/SCHEMA.md §2) — every toggle here writes a new row, it
 * never edits history.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "../design";
import { api, ConsentState } from "../shared/api";
import { colors, spacing } from "../shared/theme";
import { Card, ErrorText } from "../shared/ui";

const SCOPE_LABELS: Record<string, { title: string; description: string }> = {
  data_collection: {
    title: "Learning activity data",
    description: "Lets AURA track progress and adapt lessons. Required to use the app.",
  },
  research_use: {
    title: "Include in anonymized research data (optional)",
    description:
      "Lets AURA's research team include this child's pseudonymous session data (never name or nickname) in the study dataset. Can be withdrawn at any time.",
  },
};

export function ConsentScreen({
  childId,
  onBack,
  onWithdrawn,
}: {
  childId: string;
  onBack: () => void;
  onWithdrawn: () => void;
}) {
  const [consents, setConsents] = useState<ConsentState[] | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const load = useCallback(async () => {
    try {
      setConsents(await api.getConsent(childId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(scope: string, granted: boolean) {
    setConsents((prev) => prev?.map((c) => (c.scope === scope ? { ...c, granted } : c)) ?? null);
    try {
      await api.setConsent(childId, scope, granted);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      load(); // revert optimistic update on failure
    }
  }

  async function exportData() {
    setExporting(true);
    setError("");
    try {
      const data = await api.exportChildData(childId);
      if (Platform.OS === "web") {
        // Web only for now — a native file-save flow needs expo-file-system
        // + expo-sharing, not yet added (docs/PLAN.md Phase 9 note).
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `aura-export-${childId}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert("Export ready", "Data was fetched successfully. Downloading a file isn't supported on this device yet — use the web dashboard to save it.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function doWithdraw() {
    setDeleting(true);
    setError("");
    try {
      await api.withdrawAndDeleteChild(childId);
      onWithdrawn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <Screen title="Privacy & consent" onBack={onBack} backLabel="Progress">

      <ErrorText>{error}</ErrorText>

      {consents === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        Object.entries(SCOPE_LABELS).map(([scope, meta]) => {
          const current = consents.find((c) => c.scope === scope);
          return (
            <Card key={scope}>
              <View style={styles.row}>
                <View style={styles.textCol}>
                  <Text style={styles.title}>{meta.title}</Text>
                  <Text style={styles.description}>{meta.description}</Text>
                </View>
                <Switch
                  value={current?.granted ?? false}
                  onValueChange={(v) => toggle(scope, v)}
                  disabled={scope === "data_collection"}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            </Card>
          );
        })
      )}

      <Card>
        <Text style={styles.title}>Your data</Text>
        <Text style={styles.description}>
          Download everything AURA has recorded for this child, or withdraw from the study entirely.
        </Text>
        <Pressable style={styles.exportButton} onPress={exportData} disabled={exporting}>
          <Text style={styles.exportButtonText}>{exporting ? "Preparing export…" : "Export my child's data"}</Text>
        </Pressable>

        {!confirmingWithdraw ? (
          <Pressable style={styles.withdrawButton} onPress={() => setConfirmingWithdraw(true)}>
            <Text style={styles.withdrawButtonText}>Withdraw & delete all data</Text>
          </Pressable>
        ) : (
          <View style={styles.confirmPanel}>
            <Text style={styles.confirmText}>
              This permanently deletes every session, answer, and progress record for this child. This cannot be
              undone. Are you sure?
            </Text>
            <View style={styles.confirmRow}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setConfirmingWithdraw(false)}
                disabled={deleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmDeleteButton} onPress={doWithdraw} disabled={deleting}>
                <Text style={styles.confirmDeleteButtonText}>{deleting ? "Deleting…" : "Yes, delete everything"}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Card>

      <Text style={styles.footnote}>
        AURA never uses a camera or microphone to record your child, and never uses activity data to
        diagnose autism, emotions, or any mental health condition. Answers are treated as uncertain and
        only ever inform gentle, reversible adjustments to the lesson.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  textCol: { flex: 1, marginRight: spacing.md },
  title: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 },
  description: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  footnote: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
  exportButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: spacing.md,
  },
  exportButtonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 14 },
  withdrawButton: {
    backgroundColor: "#FCEAEA",
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  withdrawButtonText: { color: "#C0392B", fontWeight: "700", fontSize: 14 },
  confirmPanel: {
    backgroundColor: "#FCEAEA",
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "#E8B4B0",
  },
  confirmText: { color: "#8B2E24", fontSize: 13, lineHeight: 18, marginBottom: spacing.sm, fontWeight: "600" },
  confirmRow: { flexDirection: "row", gap: spacing.sm },
  cancelButton: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  cancelButtonText: { color: colors.textSecondary, fontWeight: "700", fontSize: 14 },
  confirmDeleteButton: { flex: 1, backgroundColor: "#C0392B", borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  confirmDeleteButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
