/**
 * docs/PLAN.md UX-overhaul Phase C: the parent types whatever their child is
 * actually into — not a pick from the 4 fixed built-in themes — and the app
 * searches real, licensed photos for it. Nothing reaches the child until the
 * parent taps one: that tap is the safety gate, on top of the backend's own
 * Commons-curation + banned-word/unsafe-title filtering (companion_service.py).
 */
import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { api, CompanionCandidate } from "../shared/api";
import { API_BASE } from "../shared/api";
import { colors, radius, spacing } from "../shared/theme";
import { ErrorText, LabeledInput, PrimaryButton } from "../shared/ui";

export function CompanionPicker({
  childId,
  existingName,
  existingImageUrl,
  onChanged,
}: {
  childId: string;
  existingName?: string | null;
  existingImageUrl?: string | null;
  onChanged?: (name: string, imageUrl: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<CompanionCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [confirmingUrl, setConfirmingUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{ name: string; imageUrl: string } | null>(
    existingName && existingImageUrl ? { name: existingName, imageUrl: existingImageUrl } : null
  );

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setCandidates(null);
    try {
      const results = await api.searchCompanion(childId, query.trim());
      setCandidates(results);
      if (results.length === 0) {
        setError(`No photos found for "${query.trim()}" — try a simpler word.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  async function confirm(candidate: CompanionCandidate) {
    setConfirmingUrl(candidate.image_url);
    setError("");
    try {
      const result = await api.confirmCompanion(childId, query.trim(), candidate.image_url, candidate.source_title);
      setConfirmed({ name: result.companion_name, imageUrl: result.companion_image_url });
      setCandidates(null);
      onChanged?.(result.companion_name, result.companion_image_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirmingUrl(null);
    }
  }

  return (
    <View>
      {confirmed && (
        <View style={styles.confirmedRow}>
          <Image source={{ uri: `${API_BASE}${confirmed.imageUrl}` }} style={styles.confirmedPhoto} />
          <Text style={styles.confirmedText}>{confirmed.name} is their companion — say hi on every activity.</Text>
        </View>
      )}

      <LabeledInput
        label={confirmed ? "Change it" : "What does your child love?"}
        value={query}
        onChangeText={setQuery}
        placeholder="trains, unicorns, dinosaurs..."
        autoCapitalize="none"
      />
      <PrimaryButton title="Find photos" onPress={search} loading={searching} disabled={!query.trim()} />

      <ErrorText>{error}</ErrorText>

      {candidates && candidates.length > 0 && (
        <View style={styles.grid}>
          {candidates.map((c) => (
            <Pressable
              key={c.image_url}
              onPress={() => confirm(c)}
              disabled={confirmingUrl !== null}
              style={styles.candidateCard}
            >
              <Image source={{ uri: c.image_url }} style={styles.candidatePhoto} resizeMode="cover" />
              {confirmingUrl === c.image_url && (
                <View style={styles.candidateOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  confirmedRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: spacing.sm },
  confirmedPhoto: { width: 56, height: 56, borderRadius: 14 },
  confirmedText: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  candidateCard: {
    width: 84,
    height: 84,
    borderRadius: radius.button,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
  },
  candidatePhoto: { width: "100%", height: "100%" },
  candidateOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
