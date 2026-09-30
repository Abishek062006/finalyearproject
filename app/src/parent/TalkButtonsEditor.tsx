/**
 * Parent side of the Talk board: add the child's own words as photo
 * buttons — their cup, their bike, grandma, the swing. Photos stay on this
 * device (shared/deviceLists.ts); they are never uploaded.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Button, haptic, radius, spacing, Text, TextField, useTheme } from "../design";
import { pickChildPhoto } from "../shared/childPhotos";
import { MAX_TALK_BUTTONS, useTalkButtons } from "../shared/deviceLists";

export function TalkButtonsEditor({ childId }: { childId: string }) {
  const { colors } = useTheme();
  const [buttons, save] = useTalkButtons(childId);
  const [label, setLabel] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  async function add() {
    if (!label.trim() || !photo) return;
    haptic("success");
    await save([...buttons, { id: `t${Date.now().toString(36)}`, label: label.trim(), photo }]);
    setLabel("");
    setPhoto(null);
  }

  return (
    <View>
      <Text variant="footnote" tone="secondary" style={styles.intro}>
        The Talk board already has everyday words (I want, more, help, all done…). Add your child's own things here. Photos stay on this device.
      </Text>

      {buttons.length > 0 && (
        <View style={[styles.list, { backgroundColor: colors.surface }]}>
          {buttons.map((b, i) => (
            <View key={b.id} style={[styles.row, i < buttons.length - 1 && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Image source={{ uri: b.photo }} style={styles.thumb} />
              <Text variant="body" style={{ flex: 1 }}>
                {b.label}
              </Text>
              <Pressable onPress={() => save(buttons.filter((x) => x.id !== b.id))} accessibilityRole="button" accessibilityLabel={`Remove ${b.label}`} hitSlop={6}>
                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {buttons.length < MAX_TALK_BUTTONS ? (
        <View style={{ marginTop: spacing.lg }}>
          <Pressable
            onPress={async () => setPhoto((await pickChildPhoto()) ?? photo)}
            accessibilityRole="button"
            accessibilityLabel={photo ? "Change photo" : "Choose a photo"}
            style={[styles.photoPick, { backgroundColor: colors.surface, borderColor: colors.separator }]}
          >
            {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <Ionicons name="camera" size={32} color={colors.tint} />}
          </Pressable>
          <TextField label="Word" placeholder="e.g. juice" value={label} onChangeText={setLabel} maxLength={30} />
          <Button title="Add to Talk board" variant="tinted" icon="add" onPress={add} disabled={!label.trim() || !photo} />
        </View>
      ) : (
        <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.md }}>
          That's the most buttons for now. Remove one to add another.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.md, marginLeft: spacing.xxs },
  list: { borderRadius: radius.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.md },
  thumb: { width: 40, height: 40, borderRadius: 10 },
  photoPick: { width: 112, height: 112, borderRadius: 24, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: spacing.md, overflow: "hidden" },
  photo: { width: 112, height: 112 },
});
