/**
 * A short (5-20s), self-contained re-engagement interlude (README §15/§16,
 * docs/PLAN.md Phase 6) — never another long game, never punitive framing.
 * Which of the four appears is decided by the backend (DecisionEngine +
 * Thompson sampling over the "intervention" axis); this component only
 * renders whatever `intervention_type` it's given and reports back when done.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { InterventionType } from "../shared/api";
import { colors, MIN_TOUCH_TARGET, radius, spacing, THEME_ASSETS, ThemeCode, typography } from "../shared/theme";

const COPY: Record<InterventionType, { title: string; prompt: string; buttonLabel: string }> = {
  mini_game: { title: "Quick game!", prompt: "Catch the stars!", buttonLabel: "Caught them all!" },
  interest_injection: { title: "", prompt: "needs a high five!", buttonLabel: "High five! 🙌" },
  modality_switch: { title: "Quick one!", prompt: "Drag the star over!", buttonLabel: "" },
  break: { title: "Quick breather", prompt: "Take a breath with me", buttonLabel: "I'm ready!" },
};

export function InterventionScreen({
  type,
  theme,
  onDone,
}: {
  type: InterventionType;
  theme: ThemeCode;
  onDone: () => void;
}) {
  if (type === "modality_switch") {
    return <DragToFinish theme={theme} onDone={onDone} />;
  }
  if (type === "mini_game") {
    return <CatchStars onDone={onDone} />;
  }
  if (type === "break") {
    return <CalmBreath onDone={onDone} />;
  }
  return <InterestGreeting theme={theme} onDone={onDone} />;
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
            style={styles.starButton}
          >
            <Text style={styles.starEmoji}>{isCaught ? "✨" : "⭐"}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

// ---- interest_injection: themed character greeting ----
function InterestGreeting({ theme, onDone }: { theme: ThemeCode; onDone: () => void }) {
  const asset = THEME_ASSETS[theme];
  return (
    <Screen title={`${asset.guideName} ${COPY.interest_injection.prompt}`} prompt="">
      <Text style={styles.bigEmoji}>{asset.emoji}</Text>
      <PrimaryAction label={COPY.interest_injection.buttonLabel} onPress={onDone} />
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
function DragToFinish({ theme, onDone }: { theme: ThemeCode; onDone: () => void }) {
  const pan = useRef(new Animated.ValueXY()).current;
  const zoneRef = useRef<View>(null);
  const zoneRect = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const asset = THEME_ASSETS[theme];

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
        <Text style={styles.dropZoneEmoji}>{asset.emoji}</Text>
      </View>
      <Animated.View {...panResponder.panHandlers} style={[styles.star, { transform: pan.getTranslateTransform() }]}>
        <Text style={styles.starEmoji}>⭐</Text>
      </Animated.View>
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
  title: { fontSize: typography.prompt * 0.6, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.sm, textAlign: "center" },
  prompt: { fontSize: 20, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: "center" },
  bigEmoji: { fontSize: 96, marginBottom: spacing.lg },
  starRow: { flexDirection: "row", gap: spacing.lg },
  starButton: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  starEmoji: { fontSize: 48 },
  actionButton: { backgroundColor: colors.success, borderRadius: radius.button, paddingVertical: 14, paddingHorizontal: 32, marginTop: spacing.md },
  actionButtonText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  breathCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primary, marginBottom: spacing.lg },
  dropZone: {
    width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: colors.primary, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xl, backgroundColor: "#FFF1E4",
  },
  dropZoneEmoji: { fontSize: 56 },
  star: { position: "absolute", bottom: spacing.xl, width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
});
