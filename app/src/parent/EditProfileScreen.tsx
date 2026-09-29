/**
 * Edits one part of a child's profile using the same question component the
 * onboarding flow used, so answers look identical wherever they're given.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Button, haptic, Screen, spacing, Text, TextField, useTheme } from "../design";
import { InterestSearch } from "../onboarding/InterestSearch";
import { AgeStep, CommunicationStep, GoalsStep, SensoryStep } from "../onboarding/steps";
import { api, Child, ChildProfilePatch } from "../shared/api";
import { ProfileField } from "./ChildProfileScreen";
import { Buddy } from "../companion/Buddy";
import { useBuddy } from "../companion/useBuddy";

const TITLES: Record<ProfileField, string> = {
  basics: "Name and age",
  buddy: "Learning friend",
  communication: "Communication",
  sensory: "Sensory needs",
  goals: "Learning goals",
  interests: "Add an interest",
};

export function EditProfileScreen({ childId, field, onDone }: { childId: string; field: ProfileField; onDone: () => void }) {
  const { colors } = useTheme();
  const [child, setChild] = useState<Child | null>(null);
  const [draft, setDraft] = useState<ChildProfilePatch>({});
  const [saving, setSaving] = useState(false);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getChild(childId)
      .then((c) => {
        setChild(c);
        setDraft({
          nickname: c.nickname,
          birth_year_month: c.birth_year_month,
          communication_level: c.communication_level,
          sensory: c.sensory,
          goals: c.goals,
          buddy_name: c.buddy,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [childId]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const patch: ChildProfilePatch =
        field === "basics"
          ? { nickname: draft.nickname?.trim(), birth_year_month: draft.birth_year_month }
          : field === "buddy"
            ? { buddy_name: draft.buddy_name?.trim() ?? "" }
            : field === "communication"
            ? { communication_level: draft.communication_level }
            : field === "sensory"
              ? { sensory: draft.sensory }
              : { goals: draft.goals };
      await api.updateChild(childId, patch);
      haptic("success");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!child) {
    return (
      <Screen title={TITLES[field]} onBack={onDone}>
        {error ? <Text tone="destructive">{error}</Text> : <ActivityIndicator color={colors.tint} />}
      </Screen>
    );
  }

  const canSave =
    field === "basics" ? !!draft.nickname?.trim() : field === "communication" ? !!draft.communication_level : field === "goals" ? (draft.goals?.length ?? 0) > 0 : true;

  return (
    <Screen title={TITLES[field]} onBack={onDone} backLabel="Profile">
      {field === "basics" && (
        <>
          <TextField label="Name or nickname" value={draft.nickname ?? ""} onChangeText={(v) => setDraft({ ...draft, nickname: v })} autoCapitalize="words" maxLength={40} />
          <Text variant="footnote" tone="secondary" style={{ marginLeft: spacing.xxs, marginBottom: spacing.xs }}>
            Birthday
          </Text>
          <AgeStep name={draft.nickname?.trim() ?? ""} value={draft.birth_year_month ?? child.birth_year_month} onChange={(v) => setDraft({ ...draft, birth_year_month: v })} />
        </>
      )}
      {field === "buddy" && <BuddyNameEditor name={draft.buddy_name ?? ""} onChange={(v) => setDraft({ ...draft, buddy_name: v })} />}
      {field === "communication" && (
        <CommunicationStep value={draft.communication_level ?? null} onChange={(v) => setDraft({ ...draft, communication_level: v })} />
      )}
      {field === "sensory" && <SensoryStep value={draft.sensory ?? []} onChange={(v) => setDraft({ ...draft, sensory: v })} />}
      {field === "goals" && <GoalsStep value={draft.goals ?? []} onChange={(v) => setDraft({ ...draft, goals: v })} />}
      {field === "interests" && (
        <InterestSearch
          busyUrl={busyUrl}
          onPick={async ({ label, candidate }) => {
            if (busyUrl) return;
            setBusyUrl(candidate.image_url);
            setError("");
            try {
              await api.addInterest(childId, { label, image_url: candidate.image_url, source_title: candidate.source_title, favourite: false });
              haptic("success");
              onDone();
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setError(message.includes("at most") ? "That's the maximum number of interests. Remove one first." : "Couldn't add that photo. Try another.");
            } finally {
              setBusyUrl(null);
            }
          }}
        />
      )}

      {!!error && (
        <Text variant="footnote" tone="destructive" style={{ marginTop: spacing.md }}>
          {error}
        </Text>
      )}

      {field !== "interests" && (
        <View style={{ marginTop: spacing.lg }}>
          <Button title="Save" onPress={save} loading={saving} disabled={!canSave} />
        </View>
      )}
    </Screen>
  );
}

/** Rename the learning friend — Pip says its new name back as you type it. */
function BuddyNameEditor({ name, onChange }: { name: string; onChange: (v: string) => void }) {
  const buddy = useBuddy();
  const shown = name.trim() || "Pip";
  return (
    <View style={{ alignItems: "center" }}>
      <Buddy buddy={buddy} size={150} />
      <View style={{ alignSelf: "stretch", marginTop: spacing.lg }}>
        <TextField
          label="Name"
          value={name}
          onChangeText={onChange}
          onBlur={() => buddy.say(`Hi! I'm ${shown}!`, { mood: "happy" })}
          maxLength={20}
          autoCapitalize="words"
          placeholder="Pip"
        />
      </View>
      <Text variant="footnote" tone="secondary" align="center">
        One friend, every day — the same name in every activity. Leave it empty to go back to Pip.
      </Text>
    </View>
  );
}
