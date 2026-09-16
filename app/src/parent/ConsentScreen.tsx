/**
 * README §18 (Camera privacy) + §2A items 15-17. Consent is append-only on
 * the backend (docs/SCHEMA.md §2) — every toggle here writes a new row, it
 * never edits history.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { api, ConsentState } from "../shared/api";
import { colors, spacing } from "../shared/theme";
import { Card, ErrorText, ScreenTitle, SecondaryButton } from "../shared/ui";

const SCOPE_LABELS: Record<string, { title: string; description: string }> = {
  data_collection: {
    title: "Learning activity data",
    description: "Lets AURA track progress and adapt lessons. Required to use the app.",
  },
  camera: {
    title: "Camera (optional)",
    description:
      "Estimates broad engagement signals (e.g. looking away) to help time gentle breaks. Never used for diagnosis, and off by default.",
  },
};

export function ConsentScreen({ childId, onBack }: { childId: string; onBack: () => void }) {
  const [consents, setConsents] = useState<ConsentState[] | null>(null);
  const [error, setError] = useState("");

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <ScreenTitle>Privacy & consent</ScreenTitle>
        <SecondaryButton title="← Back" onPress={onBack} />
      </View>

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

      <Text style={styles.footnote}>
        AURA never uses camera or activity data to diagnose autism, emotions, or any mental health
        condition. Signals are treated as uncertain and only ever inform gentle, reversible adjustments
        to the lesson.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 560, width: "100%", alignSelf: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  textCol: { flex: 1, marginRight: spacing.md },
  title: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 },
  description: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  footnote: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
});
