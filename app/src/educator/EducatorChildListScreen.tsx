import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, Child } from "../shared/api";
import { authStore } from "../shared/authStore";
import { colors, spacing } from "../shared/theme";
import { Card, ErrorText, ScreenTitle, SecondaryButton } from "../shared/ui";

export function EducatorChildListScreen({ onOpenProfile, onLogout }: { onOpenProfile: (childId: string) => void; onLogout: () => void }) {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setChildren(await api.educatorListChildren());
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
        <ScreenTitle>Your students</ScreenTitle>
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
          <Text style={styles.emptyText}>
            No students yet. A parent needs to grant you access from their child's Privacy & camera settings screen,
            using this account's email.
          </Text>
        </Card>
      ) : (
        children.map((child) => (
          <Card key={child.id}>
            <Text style={styles.nickname}>{child.nickname}</Text>
            <Text style={styles.meta}>Born {child.birth_year_month}</Text>
            <SecondaryButton title="View detailed profile" onPress={() => onOpenProfile(child.id)} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 560, width: "100%", alignSelf: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  emptyText: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  nickname: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  meta: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
});
