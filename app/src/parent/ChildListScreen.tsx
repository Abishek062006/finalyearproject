import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button, Card, radius, Screen, spacing, Text, useTheme } from "../design";
import { api, API_BASE, Child } from "../shared/api";
import { CompanionPicker } from "./CompanionPicker";

export function ChildListScreen({
  onAddChild,
  onOpenDashboard,
  onPlay,
  onOpenSettings,
}: {
  onAddChild: () => void;
  onOpenDashboard: (childId: string) => void;
  onPlay: (childId: string) => void;
  onOpenSettings: () => void;
}) {
  const { colors } = useTheme();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState("");
  const [editingCompanionFor, setEditingCompanionFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      setChildren(await api.listChildren());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Reload whenever this screen comes back into view (after adding a child, after a session...).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen
      title="Children"
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
        <Card style={styles.empty}>
          <Ionicons name="happy-outline" size={44} color={colors.labelTertiary} />
          <Text variant="title3" align="center" style={{ marginTop: spacing.sm }}>
            No children yet
          </Text>
          <Text variant="subhead" tone="secondary" align="center" style={{ marginTop: spacing.xxs, marginBottom: spacing.md }}>
            Add your child to set up their learning space.
          </Text>
          <Button title="Add a child" icon="add" onPress={onAddChild} />
        </Card>
      ) : (
        <>
          {children.map((child) => (
            <Card key={child.id}>
              <View style={styles.header}>
                <View style={[styles.avatar, { backgroundColor: colors.fill }]}>
                  {child.companion_image_url ? (
                    <Image source={{ uri: `${API_BASE}${child.companion_image_url}` }} style={styles.avatarImage} />
                  ) : (
                    <Text variant="title2" tone="secondary">
                      {child.nickname.slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="title3">{child.nickname}</Text>
                  <Text variant="subhead" tone="secondary">
                    {child.companion_name ? `Companion: ${child.companion_name}` : `Born ${child.birth_year_month}`}
                  </Text>
                </View>
              </View>

              {editingCompanionFor === child.id ? (
                <View style={{ marginTop: spacing.md }}>
                  <CompanionPicker
                    childId={child.id}
                    existingName={child.companion_name}
                    existingImageUrl={child.companion_image_url}
                    onChanged={() => load()}
                  />
                  <Button title="Done" variant="plain" size="medium" fullWidth onPress={() => setEditingCompanionFor(null)} />
                </View>
              ) : (
                <View style={styles.actions}>
                  <Button title="Start learning" icon="play" onPress={() => onPlay(child.id)} />
                  <View style={styles.secondaryRow}>
                    <Button title="Progress" icon="bar-chart-outline" variant="tinted" size="medium" fullWidth onPress={() => onOpenDashboard(child.id)} style={{ flex: 1 }} />
                    <Button
                      title={child.companion_name ? "Companion" : "Add companion"}
                      icon="sparkles-outline"
                      variant="tinted"
                      size="medium"
                      fullWidth
                      onPress={() => setEditingCompanionFor(child.id)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              )}
            </Card>
          ))}
          <Button title="Add another child" icon="add" variant="plain" onPress={onAddChild} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  secondaryRow: { flexDirection: "row", gap: spacing.sm },
});
