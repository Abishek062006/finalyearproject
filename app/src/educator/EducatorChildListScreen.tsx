import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { Card, ListRow, ListSection, Screen, spacing, Text, useTheme } from "../design";
import { api, Child } from "../shared/api";

export function EducatorChildListScreen({ onOpenProfile, onOpenSettings }: { onOpenProfile: (childId: string) => void; onOpenSettings: () => void }) {
  const { colors } = useTheme();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setChildren(await api.educatorListChildren());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen
      title="Students"
      rightAction={
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12} onPress={onOpenSettings}>
          {({ pressed }) => <Ionicons name="settings-outline" size={24} color={colors.tint} style={{ opacity: pressed ? 0.4 : 1 }} />}
        </Pressable>
      }
    >
      {!!error && (
        <Text variant="footnote" tone="destructive" style={{ marginBottom: spacing.sm }}>
          {error}
        </Text>
      )}

      {children === null ? (
        <ActivityIndicator color={colors.tint} style={{ marginTop: spacing.xl }} />
      ) : children.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <Ionicons name="people-outline" size={44} color={colors.labelTertiary} />
          <Text variant="title3" align="center" style={{ marginTop: spacing.sm }}>
            No students yet
          </Text>
          <Text variant="subhead" tone="secondary" align="center" style={{ marginTop: spacing.xxs }}>
            A parent grants you access from their child's Privacy settings, using this account's email.
          </Text>
        </Card>
      ) : (
        <ListSection header="Linked students">
          {children.map((child) => (
            <ListRow
              key={child.id}
              title={child.nickname}
              subtitle={`Born ${child.birth_year_month}`}
              icon="person"
              accessory="chevron"
              onPress={() => onOpenProfile(child.id)}
            />
          ))}
        </ListSection>
      )}
    </Screen>
  );
}
