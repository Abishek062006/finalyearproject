/**
 * README §2A items 1-3 + §5: create a child profile with a nickname, age
 * band, and a handful of initial interests (stored as a PRIOR — README §6 —
 * never shown back to the parent as if it were a measured fact).
 */
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "../shared/api";
import { spacing } from "../shared/theme";
import { Card, ErrorText, LabeledInput, PrimaryButton, ScreenTitle, SecondaryButton, SectionLabel } from "../shared/ui";
import { InterestPicker } from "./InterestPicker";

export function CreateChildScreen({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [nickname, setNickname] = useState("");
  const [birthYearMonth, setBirthYearMonth] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!nickname.trim() || !birthYearMonth.trim()) {
      setError("Please enter a nickname and birth year/month (e.g. 2020-03).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.createChild(nickname.trim(), birthYearMonth.trim(), interests);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenTitle>Add a child</ScreenTitle>
      <Card>
        <LabeledInput label="Nickname" value={nickname} onChangeText={setNickname} placeholder="Rae" autoCapitalize="words" />
        <LabeledInput label="Birth year and month" value={birthYearMonth} onChangeText={setBirthYearMonth} placeholder="2020-03" />

        <View style={{ height: spacing.sm }} />
        <SectionLabel>What does your child enjoy?</SectionLabel>
        <InterestPicker selected={interests} onChange={setInterests} />

        <ErrorText>{error}</ErrorText>
        <View style={{ height: spacing.sm }} />
        <PrimaryButton title="Create profile" onPress={submit} loading={loading} />
        <SecondaryButton title="Cancel" onPress={onCancel} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 520, width: "100%", alignSelf: "center" },
});
