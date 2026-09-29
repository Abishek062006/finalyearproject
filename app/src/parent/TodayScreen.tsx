/**
 * The parent home (plan Phase 1): one child at a time, centred on "today" —
 * start the session, see the one suggestion that matters, glance at
 * progress. A profile switcher appears when there's more than one child.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Chip, haptic, ListRow, ListSection, radius, Screen, spacing, Text, useTheme } from "../design";
import { GOAL_OPTIONS, ageInYears } from "../onboarding/options";
import { api, Child, ChildSummary } from "../shared/api";
import { selectedChild } from "../shared/selectedChild";
import { ChildAvatar } from "./ChildAvatar";

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function TodayScreen({
  onSetUpChild,
  onPlay,
  onOpenProgress,
  onOpenProfile,
  onOpenConsent,
  onOpenSettings,
}: {
  onSetUpChild: () => void;
  onPlay: (childId: string) => void;
  onOpenProgress: (childId: string) => void;
  onOpenProfile: (childId: string) => void;
  onOpenConsent: (childId: string) => void;
  onOpenSettings: () => void;
}) {
  const { colors } = useTheme();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ChildSummary | null>(null);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async (childId: string) => {
    setSummary(null);
    try {
      setSummary(await api.childSummary(childId));
    } catch {
      // The rest of the screen still works without the summary card.
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError("");
      const list = await api.listChildren();
      setChildren(list);
      if (list.length === 0) return;
      const remembered = await selectedChild.get();
      const id = list.some((c) => c.id === remembered) ? remembered! : list[0].id;
      setCurrentId(id);
      loadSummary(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [loadSummary]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function switchTo(id: string) {
    if (id === currentId) return;
    haptic("select");
    setCurrentId(id);
    selectedChild.set(id);
    loadSummary(id);
  }

  const child = children?.find((c) => c.id === currentId) ?? null;
  const settingsButton = (
    <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12} onPress={onOpenSettings}>
      {({ pressed }) => <Ionicons name="settings-outline" size={24} color={colors.tint} style={{ opacity: pressed ? 0.4 : 1 }} />}
    </Pressable>
  );

  if (children === null) {
    return (
      <Screen title={greeting()} rightAction={settingsButton}>
        {error ? (
          <Text variant="footnote" tone="destructive">
            {error}
          </Text>
        ) : (
          <ActivityIndicator color={colors.tint} style={{ marginTop: spacing.xl }} />
        )}
      </Screen>
    );
  }

  if (children.length === 0 || !child) {
    return (
      <Screen title={greeting()} rightAction={settingsButton}>
        <Card style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.tintSoft }]}>
            <Ionicons name="happy" size={40} color={colors.tint} />
          </View>
          <Text variant="title2" align="center" style={{ marginTop: spacing.md }}>
            Let's set up your child
          </Text>
          <Text variant="subhead" tone="secondary" align="center" style={{ marginTop: spacing.xxs, marginBottom: spacing.lg }}>
            A few quick questions so AURA can fit the way they learn. Takes about two minutes.
          </Text>
          <Button title="Set up my child" onPress={onSetUpChild} />
        </Card>
      </Screen>
    );
  }

  const minutes = Math.round(summary?.recommended_session_minutes ?? 15);
  const focus = GOAL_OPTIONS.filter((g) => child.goals.includes(g.value) && g.available);
  const suggestion = summary?.todays_suggestions.find((s) => !s.response);
  const age = ageInYears(child.birth_year_month);

  return (
    <Screen title={greeting()} rightAction={settingsButton}>
      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcher}>
          {children.map((c) => {
            const active = c.id === child.id;
            return (
              <Pressable key={c.id} onPress={() => switchTo(c.id)} accessibilityRole="tab" aria-selected={active} style={styles.switcherItem}>
                <View style={[styles.switcherRing, { borderColor: active ? colors.tint : "transparent" }]}>
                  <ChildAvatar child={c} size={52} />
                </View>
                <Text variant="caption" tone={active ? "primary" : "secondary"} style={{ marginTop: 4, fontWeight: active ? "600" : "400" }}>
                  {c.nickname}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={onSetUpChild} accessibilityRole="button" accessibilityLabel="Add another child" style={styles.switcherItem}>
            <View style={[styles.addCircle, { borderColor: colors.separator }]}>
              <Ionicons name="add" size={26} color={colors.tint} />
            </View>
            <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              Add
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Today's session — the one thing a parent opens the app to do. */}
      <Card style={{ padding: spacing.lg }}>
        <View style={styles.heroRow}>
          <ChildAvatar child={child} size={72} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text variant="title2">{child.nickname}</Text>
            <Text variant="subhead" tone="secondary">
              {age} {age === 1 ? "year" : "years"} old{child.companion_name ? ` · learns with ${child.companion_name}` : ""}
            </Text>
          </View>
        </View>

        <View style={[styles.planBox, { backgroundColor: colors.background }]}>
          <Text variant="footnote" tone="secondary">
            TODAY'S SESSION
          </Text>
          <Text variant="title3" style={{ marginTop: 2 }}>
            About {minutes} minutes
          </Text>
          {focus.length > 0 && (
            <View style={styles.focusRow}>
              {focus.map((g) => (
                <View key={g.value} style={[styles.focusPill, { backgroundColor: colors.surface }]}>
                  <Ionicons name={g.icon} size={13} color={g.color} />
                  <Text variant="caption" style={{ marginLeft: 4 }}>
                    {g.short}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Button title={`Start ${child.nickname}'s session`} icon="play" onPress={() => onPlay(child.id)} />
      </Card>

      {suggestion && (
        <Card>
          <View style={styles.suggestionHead}>
            <Ionicons name="bulb" size={18} color="#FF9F0A" />
            <Text variant="headline" style={{ marginLeft: spacing.xs }}>
              Today's suggestion
            </Text>
          </View>
          <Text variant="body" style={{ marginTop: spacing.xs }}>
            {suggestion.payload.message ?? "A little revision would help."}
          </Text>
          <View style={styles.suggestionActions}>
            <Chip
              label="Sounds good"
              icon="checkmark"
              onPress={async () => {
                await api.respondToRecommendation(suggestion.id, "accepted");
                loadSummary(child.id);
              }}
            />
            <Chip
              label="Not today"
              onPress={async () => {
                await api.respondToRecommendation(suggestion.id, "skipped");
                loadSummary(child.id);
              }}
            />
          </View>
        </Card>
      )}

      {summary && (
        <View style={styles.stats}>
          <Stat value={String(Math.round(summary.learning_minutes_total))} label="minutes learning" />
          <Stat value={String(summary.activities_completed)} label="activities done" />
          <Stat value={String(summary.topics_to_review.length)} label="to revisit" />
        </View>
      )}

      <ListSection>
        <ListRow title="Progress" icon="bar-chart" iconColor="#34C759" accessory="chevron" onPress={() => onOpenProgress(child.id)} />
        <ListRow title={`${child.nickname}'s profile`} subtitle="Interests, sensory needs, goals" icon="person-circle" iconColor="#0A84FF" accessory="chevron" onPress={() => onOpenProfile(child.id)} />
        <ListRow title="Privacy & sharing" icon="lock-closed" iconColor="#8E8E93" accessory="chevron" onPress={() => onOpenConsent(child.id)} />
      </ListSection>

      {children.length === 1 && (
        <ListSection>
          <ListRow title="Add another child" icon="add" iconColor="#5E5CE6" onPress={onSetUpChild} />
        </ListSection>
      )}
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }]} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="title2">{value}</Text>
      <Text variant="caption" tone="secondary" align="center">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  switcher: { gap: spacing.md, paddingBottom: spacing.md },
  switcherItem: { alignItems: "center" },
  switcherRing: { borderWidth: 3, borderRadius: 32, padding: 2 },
  addCircle: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginTop: 3 },
  heroRow: { flexDirection: "row", alignItems: "center" },
  planBox: { borderRadius: radius.md, padding: spacing.md, marginVertical: spacing.md },
  focusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  focusPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  suggestionHead: { flexDirection: "row", alignItems: "center" },
  suggestionActions: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.md },
  stats: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  stat: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.lg },
});
