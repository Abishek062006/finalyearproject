/**
 * A learning friend frozen in one feeling — a picture to learn from, used by
 * the feelings lessons (plan Phase 5). Each face is its own little buddy, so
 * a lesson can show the same feeling on different friends, which is how a
 * child learns that "sad" looks sad on anyone.
 *
 * Expressions are deliberately bigger than the buddy's everyday moods: early
 * emotion teaching uses clear, exaggerated faces, and fades to subtler ones
 * only later.
 */
import React, { useEffect } from "react";
import { View } from "react-native";
import { Buddy } from "./Buddy";
import { useBuddy } from "./useBuddy";

export type Feeling = "happy" | "sad" | "angry" | "scared" | "surprised";

const FACES: Record<Feeling, { smile: number; open: number; round: number; width: number; browY: number; browTilt: number; squint: number }> = {
  happy: { smile: 1.5, open: 0.35, round: 0, width: 1.35, browY: -1, browTilt: 0, squint: 0.8 },
  sad: { smile: -1.5, open: 0, round: 0, width: 1.15, browY: 0.4, browTilt: 24, squint: 0.8 },
  angry: { smile: -1, open: 0.15, round: 0, width: 1.25, browY: 1.2, browTilt: -26, squint: 0.62 },
  scared: { smile: -1.3, open: 0.28, round: 0, width: 1.35, browY: -1.4, browTilt: 24, squint: 1.35 },
  surprised: { smile: 0, open: 0.9, round: 0.9, width: 1, browY: -2, browTilt: 0, squint: 1.3 },
};

export function FeelingFace({ feeling, species, size }: { feeling: Feeling; species: string; size: number }) {
  const buddy = useBuddy({ reduceMotion: true });
  useEffect(() => {
    const f = FACES[feeling];
    const v = buddy.values;
    v.smile.value = f.smile;
    v.mouthOpen.value = f.open;
    v.mouthRound.value = f.round;
    v.mouthWidth.value = f.width;
    v.browY.value = f.browY;
    v.browTilt.value = f.browTilt;
    v.squint.value = f.squint;
    v.tilt.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeling]);
  // A close-up of the head: the buddy is drawn larger and cropped to its face,
  // so the expression fills the picture instead of the whole body.
  const drawn = size * 1.55;
  const u = drawn / 100;
  return (
    <View style={{ width: size, height: size, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: (size - drawn) / 2, top: -14 * u }}>
        <Buddy buddy={buddy} size={drawn} species={species} />
      </View>
    </View>
  );
}
