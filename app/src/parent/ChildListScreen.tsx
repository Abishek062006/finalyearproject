import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, Child } from "../shared/api";
import { authStore } from "../shared/authStore";
import { colors, spacing } from "../shared/theme";
import { Card, ErrorText, PrimaryButton, ScreenTitle, SecondaryButton } from "../shared/ui";

export function ChildListScreen({
  onAddChild,
  onOpenDashboard,
  onPlay,
  onLogout,
}: {
  onAddChild: () => void;
  onOpenDashboard: (childId: string) => void;
  onPlay: (childId: string) => void;
  onLogout: () => void;
}) {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setChildren(await api.listChildren());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <ScreenTitle>Your children</ScreenTitle>
        <SecondaryButton
          title="Log out"
          onPress={() => {
            authStore.setToken(null);
            onLogout();
          }}
        />
      </View>

      <ErrorText>{error}</ErrorText>

      {children === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : children.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>No children yet. Add one to get started.</Text>
        </Card>
      ) : (
        children.map((child) => (
          <Card key={child.id}>
            <Text style={styles.nickname}>{child.nickname}</Text>
            <Text style={styles.meta}>Born {child.birth_year_month}</Text>
            <View style={styles.buttonRow}>
              <Pressable style={styles.playButton} onPress={() => onPlay(child.id)}>
                <Text style={styles.playButtonText}>▶ Play</Text>
              </Pressable>
              <SecondaryButton title="View progress" onPress={() => onOpenDashboard(child.id)} />
            </View>
          </Card>
        ))
      )}

      <View style={{ height: spacing.sm }} />
      <PrimaryButton title="+ Add a child" onPress={onAddChild} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 560, width: "100%", alignSelf: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  emptyText: { color: colors.textSecondary, fontSize: 15 },
  nickname: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  meta: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  playButton: { backgroundColor: colors.success, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 18 },
  playButtonText: { color: "#fff", fontWeight: "700" },
});
