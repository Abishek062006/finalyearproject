/**
 * README §2A items 1-3 + §5: create a child profile with a nickname, age
 * band, and a companion (docs/PLAN.md UX-overhaul Phase C: a parent-chosen,
 * real photo — not a pick from the 4 fixed built-in themes, which stay
 * reserved for the randomized theme-preference experiment).
 *
 * Two steps, not one flat form: the companion search needs the child to
 * already exist (it's stored per-child), so step 2 only appears once step 1
 * has actually created the profile.
 */
import React, { useState } from "react";
import { View } from "react-native";
import { api, Child } from "../shared/api";
import { Screen } from "../design";
import { spacing } from "../shared/theme";
import { Card, ErrorText, LabeledInput, PrimaryButton, SecondaryButton, SectionLabel } from "../shared/ui";
import { CompanionPicker } from "./CompanionPicker";
import { InterestPicker } from "./InterestPicker";

export function CreateChildScreen({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [nickname, setNickname] = useState("");
  const [birthYearMonth, setBirthYearMonth] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdChild, setCreatedChild] = useState<Child | null>(null);

  async function submit() {
    if (!nickname.trim() || !birthYearMonth.trim()) {
      setError("Please enter a nickname and birth year/month (e.g. 2020-03).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const child = await api.createChild(nickname.trim(), birthYearMonth.trim(), interests);
      setCreatedChild(child); // reveals step 2 — the companion needs a real child_id to attach to
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (createdChild) {
    return (
      <Screen title="One more thing">
        <Card>
          <SectionLabel>Give {createdChild.nickname} a companion</SectionLabel>
          <CompanionPicker childId={createdChild.id} />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton title="Done" onPress={onCreated} />
          <SecondaryButton title="Skip for now" onPress={onCreated} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Add a child" onBack={onCancel} backLabel="Children">
      <Card>
        <LabeledInput label="Nickname" value={nickname} onChangeText={setNickname} placeholder="Rae" autoCapitalize="words" />
        <LabeledInput label="Birth year and month" value={birthYearMonth} onChangeText={setBirthYearMonth} placeholder="2020-03" />

        <View style={{ height: spacing.sm }} />
        <SectionLabel>Quick start (optional)</SectionLabel>
        <InterestPicker selected={interests} onChange={setInterests} />

        <ErrorText>{error}</ErrorText>
        <View style={{ height: spacing.sm }} />
        <PrimaryButton title="Continue" onPress={submit} loading={loading} />
        <SecondaryButton title="Cancel" onPress={onCancel} />
      </Card>
    </Screen>
  );
}

