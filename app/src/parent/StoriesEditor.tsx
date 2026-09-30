/**
 * Parent side of social stories: start from a ready-made story (haircut,
 * dentist, new school, birthday party) or a blank one, then make it theirs
 * — rewrite a page, swap a symbol for a real photo of the actual
 * hairdresser, add or remove pages. Stories stay on this device.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Button, haptic, ListRow, ListSection, radius, spacing, Text, TextField, useTheme } from "../design";
import { pickChildPhoto } from "../shared/childPhotos";
import { useStories } from "../shared/deviceLists";
import { BLANK_PICTURE, MAX_PAGES, MAX_STORIES, newStoryId, Story, STORY_TEMPLATES, storyFromTemplate } from "../shared/stories";

export function StoriesEditor({ childId }: { childId: string }) {
  const [stories, save] = useStories(childId);
  const [editing, setEditing] = useState<Story | null>(null);

  if (editing) {
    return (
      <StoryEditor
        story={editing}
        onDone={async (story) => {
          haptic("success");
          const exists = stories.some((s) => s.id === story.id);
          await save(exists ? stories.map((s) => (s.id === story.id ? story : s)) : [...stories, story]);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
        onDelete={
          stories.some((s) => s.id === editing.id)
            ? async () => {
                await save(stories.filter((s) => s.id !== editing.id));
                setEditing(null);
              }
            : undefined
        }
      />
    );
  }

  return (
    <View>
      <Text variant="footnote" tone="secondary" style={styles.intro}>
        A social story shows your child what will happen before it happens, one page at a time. Their buddy reads it aloud. Stories and photos stay on this device.
      </Text>

      {stories.length > 0 && (
        <ListSection header="Your stories">
          {stories.map((s) => (
            <ListRow key={s.id} title={s.title} value={`${s.pages.length} pages`} icon={s.icon} iconColor="#AF52DE" accessory="chevron" onPress={() => setEditing(s)} />
          ))}
        </ListSection>
      )}

      {stories.length < MAX_STORIES && (
        <ListSection header="Add a story" footer="Ready-made stories are a starting point — change any words, and add your own photos.">
          {STORY_TEMPLATES.map((t) => (
            <ListRow key={t.title} title={t.title} icon={t.icon} iconColor="#34C759" accessory="chevron" onPress={() => setEditing(storyFromTemplate(t))} />
          ))}
          <ListRow
            title="Blank story"
            icon="add"
            iconColor="#0A84FF"
            accessory="chevron"
            onPress={() =>
              setEditing({ id: newStoryId(), title: "", icon: "book", picture: BLANK_PICTURE, pages: [{ id: newStoryId(), text: "", picture: BLANK_PICTURE }] })
            }
          />
        </ListSection>
      )}
    </View>
  );
}

function StoryEditor({
  story,
  onDone,
  onCancel,
  onDelete,
}: {
  story: Story;
  onDone: (s: Story) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Story>(story);

  const setPage = (id: string, patch: Partial<Story["pages"][number]>) =>
    setDraft({ ...draft, pages: draft.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const valid = draft.title.trim().length > 0 && draft.pages.length > 0 && draft.pages.every((p) => p.text.trim().length > 0);

  return (
    <View>
      <TextField label="Story title" placeholder="e.g. Going to the dentist" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} maxLength={40} />

      {draft.pages.map((p, i) => (
        <View key={p.id} style={[styles.page, { backgroundColor: colors.surface }]}>
          <View style={styles.pageHeader}>
            <Text variant="footnote" tone="secondary">
              Page {i + 1}
            </Text>
            <Pressable
              onPress={() => setDraft({ ...draft, pages: draft.pages.filter((x) => x.id !== p.id) })}
              disabled={draft.pages.length === 1}
              accessibilityRole="button"
              accessibilityLabel={`Remove page ${i + 1}`}
              hitSlop={6}
              style={draft.pages.length === 1 && { opacity: 0.3 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.destructive} />
            </Pressable>
          </View>
          <View style={styles.pageBody}>
            <Pressable
              onPress={async () => {
                const photo = await pickChildPhoto();
                if (photo) setPage(p.id, { photo });
              }}
              accessibilityRole="button"
              accessibilityLabel={p.photo ? `Change photo for page ${i + 1}` : `Add a photo to page ${i + 1}`}
              style={[styles.picture, { backgroundColor: colors.fill }]}
            >
              {p.photo ? <Image source={{ uri: p.photo }} style={styles.picture} /> : <Text style={styles.emoji}>{p.picture ?? BLANK_PICTURE}</Text>}
              <View style={[styles.cameraBadge, { backgroundColor: colors.tint }]}>
                <Ionicons name="camera" size={12} color={colors.onTint} />
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <TextField value={p.text} onChangeText={(text) => setPage(p.id, { text })} multiline maxLength={160} placeholder="What happens on this page" />
            </View>
          </View>
        </View>
      ))}

      {draft.pages.length < MAX_PAGES && (
        <Button
          title="Add a page"
          variant="plain"
          icon="add"
          onPress={() => setDraft({ ...draft, pages: [...draft.pages, { id: newStoryId(), text: "", picture: draft.picture ?? BLANK_PICTURE }] })}
        />
      )}

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button title="Save story" onPress={() => onDone({ ...draft, title: draft.title.trim() })} disabled={!valid} />
        <Button title="Cancel" variant="plain" onPress={onCancel} />
        {onDelete && <Button title="Delete story" variant="destructive" onPress={onDelete} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.md, marginLeft: spacing.xxs },
  page: { borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  pageBody: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  picture: { width: 72, height: 72, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  emoji: { fontSize: 34, lineHeight: 42 },
  cameraBadge: { position: "absolute", right: 4, bottom: 4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
