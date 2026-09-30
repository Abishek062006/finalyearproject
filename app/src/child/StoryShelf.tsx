/**
 * The child's story shelf and reader. One page at a time, a big picture
 * (the parent's photo, or a simple symbol), a few words, and the buddy
 * reading them aloud. Big back/next arrows; the child sets the pace.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BuddyController } from "../companion/useBuddy";
import { haptic } from "../design";
import { useStories } from "../shared/deviceLists";
import { Story } from "../shared/stories";
import { childFonts } from "../shared/theme";

export function StoryShelf({ childId, childName, buddy }: { childId: string; childName: string; buddy: BuddyController }) {
  const [stories] = useStories(childId);
  const [open, setOpen] = useState<Story | null>(null);

  useEffect(() => {
    if (!open) buddy.say(stories.length ? "Which story shall we read?" : "There are no stories yet.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stories.length]);

  if (open) return <StoryReader story={open} buddy={buddy} onClose={() => setOpen(null)} />;

  if (!stories.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="book-outline" size={56} color="#9AA3B2" />
        <Text style={styles.emptyText}>No stories yet.</Text>
        <Text style={styles.emptyHint}>A grown-up can add some in {childName}'s profile.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.shelf}>
      {stories.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => {
            haptic("select");
            setOpen(s);
          }}
          accessibilityRole="button"
          accessibilityLabel={s.title}
          style={styles.book}
        >
          {s.pages[0]?.photo ? (
            <Image source={{ uri: s.pages[0].photo }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverIcon]}>
              <Text style={styles.coverPicture}>{s.picture ?? "📖"}</Text>
            </View>
          )}
          <Text style={styles.bookTitle} numberOfLines={2}>
            {s.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function StoryReader({ story, buddy, onClose }: { story: Story; buddy: BuddyController; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const atEnd = page >= story.pages.length;
  const current = story.pages[page];

  useEffect(() => {
    buddy.say(atEnd ? "The end." : current.text, { mood: "neutral" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const go = (to: number) => {
    haptic("tap");
    setPage(Math.max(0, Math.min(story.pages.length, to)));
  };

  return (
    <ScrollView contentContainerStyle={styles.reader}>
      <Text style={styles.readerTitle}>{story.title}</Text>
      <View style={styles.page}>
        {atEnd ? (
          <>
            <Ionicons name="book" size={96} color="#8E44AD" />
            <Text style={styles.pageText}>The end</Text>
          </>
        ) : (
          <>
            {current.photo ? <Image source={{ uri: current.photo }} style={styles.photo} /> : <Text style={styles.pagePicture}>{current.picture ?? "📖"}</Text>}
            <Text style={styles.pageText}>{current.text}</Text>
          </>
        )}
      </View>
      <View style={styles.nav}>
        <Pressable onPress={() => go(page - 1)} disabled={page === 0} accessibilityRole="button" accessibilityLabel="Previous page" style={[styles.navButton, page === 0 && styles.dim]}>
          <Ionicons name="arrow-back" size={36} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.pageCount}>
          {Math.min(page + 1, story.pages.length)} / {story.pages.length}
        </Text>
        {atEnd ? (
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close the story" style={[styles.navButton, { backgroundColor: "#248A3D" }]}>
            <Ionicons name="checkmark" size={36} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable onPress={() => go(page + 1)} accessibilityRole="button" accessibilityLabel="Next page" style={styles.navButton}>
            <Ionicons name="arrow-forward" size={36} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shelf: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, padding: 20 },
  book: { width: 160, borderRadius: 22, backgroundColor: "#FFFFFF", padding: 10, alignItems: "center", gap: 8 },
  cover: { width: 140, height: 120, borderRadius: 16 },
  coverIcon: { backgroundColor: "#EFE2F6", alignItems: "center", justifyContent: "center" },
  coverPicture: { fontSize: 60, lineHeight: 72 },
  pagePicture: { fontSize: 110, lineHeight: 130 },
  bookTitle: { fontFamily: childFonts.bold, fontSize: 18, color: "#1D2433", textAlign: "center" },
  reader: { alignItems: "center", padding: 20, gap: 16 },
  readerTitle: { fontFamily: childFonts.bold, fontSize: 18, color: "#5B6475", textTransform: "uppercase", letterSpacing: 1, textAlign: "center" },
  page: { width: "100%", maxWidth: 560, minHeight: 340, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", padding: 24, gap: 18 },
  photo: { width: "100%", maxWidth: 420, aspectRatio: 4 / 3, borderRadius: 20 },
  pageText: { fontFamily: childFonts.bold, fontSize: 26, lineHeight: 36, color: "#1D2433", textAlign: "center" },
  nav: { flexDirection: "row", alignItems: "center", gap: 24 },
  navButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#8E44AD", alignItems: "center", justifyContent: "center" },
  pageCount: { fontFamily: childFonts.bold, fontSize: 20, color: "#5B6475", minWidth: 60, textAlign: "center" },
  dim: { opacity: 0.3 },
  empty: { alignItems: "center", padding: 40, gap: 10 },
  emptyText: { fontFamily: childFonts.bold, fontSize: 22, color: "#1D2433" },
  emptyHint: { fontFamily: childFonts.regular, fontSize: 17, color: "#5B6475", textAlign: "center" },
});
