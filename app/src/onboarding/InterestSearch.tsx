/**
 * Type anything the child loves, see real licensed photos, tap one. Nothing
 * a search returns reaches the child until a parent taps it — that tap is
 * the final safety check on top of the backend's own filtering
 * (companion_service.py).
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Chip, haptic, PressableScale, radius, spacing, Text, useTheme } from "../design";
import { api, CompanionCandidate } from "../shared/api";
import { INTEREST_SUGGESTIONS } from "./options";

export interface PickedPhoto {
  label: string;
  candidate: CompanionCandidate;
}

export function InterestSearch({
  onPick,
  isPicked,
  busyUrl,
}: {
  onPick: (pick: PickedPhoto) => void;
  isPicked?: (candidate: CompanionCandidate) => boolean;
  busyUrl?: string | null; // a photo currently being saved (profile editing)
}) {
  const { colors, type } = useTheme();
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [results, setResults] = useState<CompanionCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(text: string) {
    const q = text.trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const found = await api.searchInterests(q);
      setLastQuery(q);
      setResults(found);
      if (found.length === 0) setError(`No photos found for "${q}". Try a simpler word.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.includes("400") ? "Please use a simple, everyday word — letters only." : "Couldn't search right now. Check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View>
      <View style={[styles.searchField, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
        <Ionicons name="search" size={18} color={colors.labelSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search(query)}
          placeholder="Trains, unicorns, dinosaurs…"
          placeholderTextColor={colors.labelTertiary}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={[type("body"), styles.searchInput, { color: colors.label }]}
          accessibilityLabel="Search for something your child loves"
        />
        {!!query && (
          <Pressable accessibilityLabel="Clear" hitSlop={10} onPress={() => { setQuery(""); setResults(null); setError(""); }}>
            <Ionicons name="close-circle" size={18} color={colors.labelTertiary} />
          </Pressable>
        )}
      </View>

      {!results && !loading && (
        <View style={styles.chips}>
          {INTEREST_SUGGESTIONS.map((s) => (
            <Chip key={s} label={s} onPress={() => search(s)} />
          ))}
        </View>
      )}

      {loading && <ActivityIndicator color={colors.tint} style={{ marginVertical: spacing.xl }} />}

      {!!error && (
        <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.sm }}>
          {error}
        </Text>
      )}

      {results && results.length > 0 && (
        <>
          <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.md, marginBottom: spacing.xs }}>
            Tap the photo that looks most like what your child loves.
          </Text>
          <View style={styles.grid}>
            {results.map((c) => {
              const picked = isPicked?.(c) ?? false;
              return (
                <PressableScale
                  key={c.image_url}
                  haptic={null}
                  onPress={() => {
                    haptic(picked ? "select" : "drop");
                    onPick({ label: lastQuery, candidate: c });
                  }}
                  accessibilityLabel={`${lastQuery} photo: ${c.source_title}`}
                  accessibilityState={{ selected: picked }}
                  style={[styles.tile, { backgroundColor: colors.fill, borderColor: picked ? colors.tint : "transparent" }]}
                >
                  <Image source={{ uri: c.thumb_url ?? c.image_url }} style={styles.photo} resizeMode="cover" />
                  {picked && (
                    <View style={[styles.check, { backgroundColor: colors.tint }]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  )}
                  {busyUrl === c.image_url && (
                    <View style={styles.busy}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </View>
          <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
            Photos from Wikimedia Commons, used under their open licences.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  searchInput: { flex: 1, height: "100%" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: { width: "48%", aspectRatio: 1, borderRadius: radius.lg, overflow: "hidden", borderWidth: 3 },
  photo: { width: "100%", height: "100%" },
  check: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  busy: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
});
