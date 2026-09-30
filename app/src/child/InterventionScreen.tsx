/**
 * A short (5-20s), self-contained re-engagement interlude (README §15/§16,
 * docs/PLAN.md Phase 6) — never another long game, never punitive framing.
 * Which of the four appears is decided by the backend (DecisionEngine +
 * Thompson sampling over the "intervention" axis); this component only
 * renders whatever `intervention_type` it's given and reports back when done.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, ImageSourcePropType, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Buddy } from "../companion/Buddy";
import { useBuddy } from "../companion/useBuddy";
import { InterventionType } from "../shared/api";
import { colors, MIN_TOUCH_TARGET, radius, spacing, typography, childFonts } from "../shared/theme";

const COPY: Record<InterventionType, { title: string; prompt: string; buttonLabel: string }> = {
  mini_game: { title: "Quick game!", prompt: "Tap all three!", buttonLabel: "Caught them all!" },
  interest_injection: { title: "", prompt: "needs a high five!", buttonLabel: "High five!" },
  modality_switch: { title: "Quick one!", prompt: "Drag the circle over!", buttonLabel: "" },
  break: { title: "Quick breather", prompt: "Take a breath with me", buttonLabel: "I'm ready!" },
};

export function InterventionScreen({
  type,
  guideName,
  imageSource,
  species,
  onDone,
}: {
  type: InterventionType;
  guideName: string;
  imageSource: ImageSourcePropType;
  species?: string;
  onDone: () => void;
}) {
  if (type === "modality_switch") {
    return <DragToFinish imageSource={imageSource} onDone={onDone} />;
  }
  if (type === "mini_game") {
    return <CatchStars onDone={onDone} />;
  }
  if (type === "break") {
    return <CalmBreath onDone={onDone} />;
  }
  return <InterestGreeting guideName={guideName} imageSource={imageSource} species={species} onDone={onDone} />;
}

// ---- mini_game: tap all 3 stars ----
function CatchStars({ onDone }: { onDone: () => void }) {
  const [caught, setCaught] = useState<boolean[]>([false, false, false]);
  const allCaught = caught.every(Boolean);

  useEffect(() => {
    if (allCaught) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
  }, [allCaught, onDone]);

  return (
    <Screen title={COPY.mini_game.title} prompt={COPY.mini_game.prompt}>
      <View style={styles.starRow}>
        {caught.map((isCaught, i) => (
          <Pressable
            key={i}
            disabled={isCaught}
            onPress={() => setCaught((prev) => prev.map((v, j) => (j === i ? true : v)))}
            style={[styles.starButton, isCaught && styles.starButtonCaught]}
          />
        ))}
      </View>
    </Screen>
  );
}

// ---- interest_injection: guide character greeting ----
function InterestGreeting({
  guideName,
  imageSource,
  species,
  onDone,
}: {
  guideName: string;
  imageSource: ImageSourcePropType;
  species?: string;
  onDone: () => void;
}) {
  const buddy = useBuddy();
  useEffect(() => {
    buddy.enter();
    buddy.gesture("wave");
    buddy.say(`${guideName} ${COPY.interest_injection.prompt}`, { mood: "excited" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Screen title={`${guideName} ${COPY.interest_injection.prompt}`} prompt="">
      <View style={{ marginBottom: spacing.lg }}>
        <Buddy buddy={buddy} size={190} species={species} holdingUri={typeof imageSource === "object" && imageSource && "uri" in imageSource ? (imageSource.uri as string) : null} />
      </View>
      <PrimaryAction
        label={COPY.interest_injection.buttonLabel}
        onPress={() => {
          buddy.gesture("celebrate");
          buddy.setMood("excited");
          setTimeout(onDone, 700);
        }}
      />
    </Screen>
  );
}

// ---- break: a calming pulse, button appears after a moment ----
function CalmBreath({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 2000, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    const t = setTimeout(() => setReady(true), 3000);
    return () => {
      loop.stop();
      clearTimeout(t);
    };
  }, [scale]);

  return (
    <Screen title={COPY.break.title} prompt={COPY.break.prompt}>
      <Animated.View style={[styles.breathCircle, { transform: [{ scale }] }]} />
      {ready && <PrimaryAction label={COPY.break.buttonLabel} onPress={onDone} />}
    </Screen>
  );
}

// ---- modality_switch: drag the star into the target ----
function DragToFinish({ imageSource, onDone }: { imageSource: ImageSourcePropType; onDone: () => void }) {
  const pan = useRef(new Animated.ValueXY()).current;
  const zoneRef = useRef<View>(null);
  const zoneRect = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_evt, gesture) => {
        const zone = zoneRect.current;
        const inside =
          zone && gesture.moveX >= zone.x && gesture.moveX <= zone.x + zone.width && gesture.moveY >= zone.y && gesture.moveY <= zone.y + zone.height;
        if (inside) {
          onDone();
          return;
        }
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    })
  ).current;

  return (
    <Screen title={COPY.modality_switch.title} prompt={COPY.modality_switch.prompt}>
      <View
        ref={zoneRef}
        style={styles.dropZone}
        onLayout={() => zoneRef.current?.measureInWindow((x, y, width, height) => (zoneRect.current = { x, y, width, height }))}
      >
        <Image source={imageSource} style={styles.dropZonePhoto} />
      </View>
      <Animated.View {...panResponder.panHandlers} style={[styles.star, { transform: pan.getTranslateTransform() }]} />
    </Screen>
  );
}

function Screen({ title, prompt, children }: { title: string; prompt: string; children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!prompt && <Text style={styles.prompt}>{prompt}</Text>}
      {children}
    </View>
  );
}

function PrimaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionButton}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: typography.prompt * 0.6, fontFamily: childFonts.bold, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: "center" },
  prompt: { fontSize: 20, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: "center" },
  bigPhoto: { width: 160, height: 160, borderRadius: 36, marginBottom: spacing.lg },
  starRow: { flexDirection: "row", gap: spacing.lg },
  starButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  starButtonCaught: { backgroundColor: colors.primary },
  actionButton: { backgroundColor: colors.success, borderRadius: radius.button, paddingVertical: 14, paddingHorizontal: 32, marginTop: spacing.md },
  actionButtonText: { color: "#fff", fontFamily: childFonts.bold, fontSize: 18 },
  breathCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primary, marginBottom: spacing.lg },
  dropZone: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  dropZonePhoto: { width: "100%", height: "100%" },
  star: {
    position: "absolute",
    bottom: spacing.xl,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    backgroundColor: colors.primary,
  },
});
