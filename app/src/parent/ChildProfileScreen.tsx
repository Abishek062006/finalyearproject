/**
 * Everything answered during onboarding, editable later — each row opens the
 * very same question component the setup flow used (EditProfileScreen).
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { haptic, ListRow, ListSection, Screen, spacing, Text, useTheme } from "../design";
import { ageInYears, communicationLabel, goalsLabel, sensoryLabel } from "../onboarding/options";
import { api, API_BASE, Child, ChildInterest } from "../shared/api";
import { pickChildPhoto, saveChildPhoto, useChildPhoto } from "../shared/childPhotos";
import { ChildAvatar } from "./ChildAvatar";

export type ProfileField = "basics" | "buddy" | "communication" | "sensory" | "goals" | "interests" | "schedule" | "talk";

export function ChildProfileScreen({
  childId,
  onBack,
  onEdit,
  onOpenConsent,
}: {
  childId: string;
  onBack: () => void;
  onEdit: (field: ProfileField) => void;
  onOpenConsent: () => void;
}) {
  const { colors } = useTheme();
  const [child, setChild] = useState<Child | null>(null);
  const [error, setError] = useState("");
  const photo = useChildPhoto(childId);

  const load = useCallback(async () => {
    try {
      setChild(await api.getChild(childId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [childId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function makeFavourite(interest: ChildInterest) {
    if (interest.is_favourite) return;
    haptic("select");
    setChild(await api.favouriteInterest(childId, interest.id));
  }

  async function remove(interest: ChildInterest) {
    haptic("tap");
    setChild(await api.removeInterest(childId, interest.id));
  }

  if (!child) {
    return (
      <Screen title="Profile" onBack={onBack} backLabel="Today">
        {error ? <Text tone="destructive">{error}</Text> : <ActivityIndicator color={colors.tint} />}
      </Screen>
    );
  }

  const age = ageInYears(child.birth_year_month);

  return (
    <Screen title={child.nickname} onBack={onBack} backLabel="Today">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? "Change photo" : "Add a photo"}
          onPress={async () => {
            const uri = await pickChildPhoto();
            if (uri) await saveChildPhoto(child.id, uri);
          }}
        >
          <ChildAvatar child={child} size={96} />
          <View style={[styles.badge, { backgroundColor: colors.tint, borderColor: colors.background }]}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </Pressable>
        {photo && (
          <Pressable onPress={() => saveChildPhoto(child.id, null)} hitSlop={8} style={{ marginTop: spacing.xs }}>
            <Text variant="footnote" tone="tint">
              Remove photo
            </Text>
          </Pressable>
        )}
      </View>

      <ListSection header="About">
        <ListRow title="Name and age" value={`${child.nickname}, ${age}`} icon="person" iconColor="#0A84FF" accessory="chevron" onPress={() => onEdit("basics")} />
        <ListRow title="Learning friend's name" value={child.buddy} icon="happy" iconColor="#5E5CE6" accessory="chevron" onPress={() => onEdit("buddy")} />
        <ListRow title="Communication" value={communicationLabel(child.communication_level)} icon="chatbubbles" iconColor="#30B0C7" accessory="chevron" onPress={() => onEdit("communication")} />
        <ListRow title="Sensory needs" value={sensoryLabel(child.sensory)} icon="ear" iconColor="#FF9F0A" accessory="chevron" onPress={() => onEdit("sensory")} />
        <ListRow title="Learning goals" value={goalsLabel(child.goals)} icon="flag" iconColor="#34C759" accessory="chevron" onPress={() => onEdit("goals")} />
      </ListSection>

      <ListSection header="Everyday supports" footer="Your child finds these in their own space: My day shows the plan as First-Then; the Talk board speaks for them.">
        <ListRow
          title="My day"
          value={child.schedule?.length ? `${child.schedule.length} step${child.schedule.length > 1 ? "s" : ""}` : "Not set"}
          icon="calendar"
          iconColor="#FF9500"
          accessory="chevron"
          onPress={() => onEdit("schedule")}
        />
        <ListRow title="Talk board buttons" subtitle="Your child's own words, with your photos" icon="chatbubbles" iconColor="#AF52DE" accessory="chevron" onPress={() => onEdit("talk")} />
      </ListSection>

      <ListSection header="Interests" footer="The starred interest is their companion — the friend who talks to them during activities. Tap another to change it.">
        {child.interests.map((interest) => (
          <InterestRow key={interest.id} interest={interest} onPress={() => makeFavourite(interest)} onRemove={() => remove(interest)} />
        ))}
        <ListRow title="Add an interest" icon="add" iconColor="#5E5CE6" onPress={() => onEdit("interests")} />
      </ListSection>

      <ListSection>
        <ListRow title="Privacy & sharing" icon="lock-closed" iconColor="#8E8E93" accessory="chevron" onPress={onOpenConsent} />
      </ListSection>
    </Screen>
  );
}

function InterestRow({ interest, onPress, onRemove, isLast }: { interest: ChildInterest; onPress: () => void; onRemove: () => void; isLast?: boolean }) {
  const { colors } = useTheme();
  // Two sibling buttons (choose companion / remove), never one nested inside
  // the other — nested buttons are invalid on web and merge into a single
  // control for screen readers.
  return (
    <View style={styles.interestRow}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${interest.label}${interest.is_favourite ? ", companion" : ". Make companion"}`}
        style={({ pressed }) => [styles.interestMain, { backgroundColor: pressed ? colors.fill : "transparent" }]}
      >
        <Image source={{ uri: `${API_BASE}${interest.image_url}` }} style={styles.thumb} />
        <View style={[styles.interestBody, !isLast && styles.hairline, !isLast && { borderBottomColor: colors.separator }]}>
          <Text variant="body" style={{ flex: 1, textTransform: "capitalize" }}>
            {interest.label}
          </Text>
          {interest.is_favourite && <Ionicons name="star" size={18} color="#FF9F0A" />}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${interest.label}`}
        hitSlop={10}
        onPress={onRemove}
        style={[styles.removeButton, !isLast && styles.hairline, !isLast && { borderBottomColor: colors.separator }]}
      >
        <Ionicons name="remove-circle" size={22} color={colors.destructive} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: spacing.lg },
  badge: { position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  interestRow: { flexDirection: "row", alignItems: "stretch" },
  interestMain: { flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: spacing.md },
  thumb: { width: 36, height: 36, borderRadius: 8, marginRight: spacing.sm },
  interestBody: { flex: 1, flexDirection: "row", alignItems: "center", minHeight: 52, paddingRight: spacing.sm },
  removeButton: { justifyContent: "center", paddingHorizontal: spacing.md },
  hairline: { borderBottomWidth: StyleSheet.hairlineWidth },
});
