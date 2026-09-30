/**
 * A learning friend, drawn entirely in code. The artwork for each species
 * (Pip, Kiko the fox, Bao the panda…) comes from species.tsx; the moving parts
 * (eyes, brows, arms, mouth, sparkles) are the same rig for all of them, driven
 * by the shared values in useBuddy.ts, so every motion runs on the UI thread.
 *
 * Designed in a 100 × 115 unit box and scaled to `size`. Purely decorative
 * for accessibility — what Pip says is always shown as text beside it.
 */
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedProps, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";
import { speciesFor } from "./species";
import { BuddyController } from "./useBuddy";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

/** Shared by every species — the per-species palette lives in species.tsx. */
export const BUDDY_COLORS = {
  ink: "#1D2433",
  mouth: "#6B2E3E",
  tongue: "#FF8FA6",
};

export function Buddy({
  buddy,
  size = 140,
  holdingUri,
  species = "pip",
}: {
  buddy: BuddyController;
  size?: number;
  holdingUri?: string | null; // the child's favourite interest, worn as a tummy badge
  species?: string | null;
}) {
  const u = size / 100; // one design unit in pixels
  const v = buddy.values;
  const kind = speciesFor(species);
  const c = kind.colors;

  // ---- Whole body: breathing, hops, walking in, tilt ----
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: v.appear.value,
    transform: [
      { translateX: v.walkX.value * size },
      { translateY: v.hop.value * 18 * u - v.breathe.value * 1.2 * u },
      { rotate: `${v.tilt.value}deg` },
      { scaleY: 1 + v.breathe.value * 0.018 },
      { scaleX: 1 - v.breathe.value * 0.008 },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.18 * v.appear.value,
    transform: [{ translateX: v.walkX.value * size }, { scale: 1 + v.hop.value * 0.35 }],
  }));

  // ---- Eyes: blink × mood squint, and gaze ----
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: v.gazeX.value * 2.6 * u },
      { translateY: v.gazeY.value * 2.2 * u },
      { scaleY: v.blink.value * v.squint.value },
    ],
  }));

  // ---- Brows: raise/lower together, tilt mirrored (inner ends up = caring) ----
  const leftBrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: v.browY.value * 2.2 * u }, { rotate: `${-v.browTilt.value}deg` }],
  }));
  const rightBrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: v.browY.value * 2.2 * u }, { rotate: `${v.browTilt.value}deg` }],
  }));

  // ---- Arms: rotate around the shoulder ----
  const leftArmStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${v.armLeft.value}deg` }] }));
  const rightArmStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${v.armRight.value}deg` }] }));

  // ---- Mouth: one closed outline that opens into a filled shape ----
  // Mouth box is 34 × 24 units; lips meet at y = 6 when closed.
  const mouthProps = useAnimatedProps(() => {
    const cx = 17;
    const cy = 6;
    const hw = 7.2 * v.mouthWidth.value * (1 - 0.38 * v.mouthRound.value);
    const top = cy + v.smile.value * 3.6 - v.mouthOpen.value * 1.4;
    const bottom = cy + v.smile.value * 3.6 + v.mouthOpen.value * 14;
    return {
      d: `M ${cx - hw} ${cy} Q ${cx} ${top} ${cx + hw} ${cy} Q ${cx} ${bottom} ${cx - hw} ${cy} Z`,
    };
  });
  const tongueProps = useAnimatedProps(() => {
    const open = v.mouthOpen.value;
    return {
      cy: 6 + v.smile.value * 3.6 + open * 8.5,
      rx: 3.6 * v.mouthWidth.value * (1 - 0.4 * v.mouthRound.value),
      ry: 2.4 * open,
      opacity: interpolate(open, [0.25, 0.5], [0, 1], "clamp"),
    };
  });

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: v.sparkle.value,
    transform: [{ scale: 0.4 + v.sparkle.value * 0.8 }, { rotate: `${v.sparkle.value * 40}deg` }],
  }));

  const at = (x: number, y: number) => ({ left: x * u, top: y * u });

  return (
    <View style={{ width: size, height: 118 * u }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* ground shadow stays on the floor while the body hops */}
      <Animated.View style={[styles.abs, { left: 22 * u, top: 108 * u, width: 56 * u, height: 8 * u, borderRadius: 4 * u, backgroundColor: BUDDY_COLORS.ink }, shadowStyle]} />

      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: "50% 100%" }, bodyStyle]}>
        {/* tails, wings, spikes, antennae — behind everything */}
        {kind.back && (
          <Svg width={size} height={118 * u} viewBox="0 0 100 118" style={styles.abs}>
            {kind.back()}
          </Svg>
        )}

        {/* arms sit BEHIND the body so the shoulder joint is hidden */}
        <Arm style={leftArmStyle} u={u} x={13} color={c.shade} hand={c.hand} />
        <Arm style={rightArmStyle} u={u} x={87} color={c.shade} hand={c.hand} />

        <Svg width={size} height={118 * u} viewBox="0 0 100 118" style={styles.abs}>
          {kind.body()}
          {kind.eyeRing && (
            <>
              <Ellipse cx={38} cy={47} rx={6.5} ry={7.8} fill={kind.eyeRing} />
              <Ellipse cx={62} cy={47} rx={6.5} ry={7.8} fill={kind.eyeRing} />
            </>
          )}
        </Svg>

        {/* eyes */}
        {[38, 62].map((x) => (
          <Animated.View key={x} style={[styles.abs, at(x - 5.5, 40), { width: 11 * u, height: 14 * u, borderRadius: 6 * u, backgroundColor: c.eye }, eyeStyle]}>
            <View style={{ position: "absolute", left: 5.8 * u, top: 2.2 * u, width: 3.6 * u, height: 3.6 * u, borderRadius: 2 * u, backgroundColor: "#FFFFFF" }} />
            <View style={{ position: "absolute", left: 3 * u, top: 8.5 * u, width: 1.8 * u, height: 1.8 * u, borderRadius: 1 * u, backgroundColor: "#FFFFFF", opacity: 0.7 }} />
          </Animated.View>
        ))}

        {/* brows */}
        <Animated.View style={[styles.abs, at(31, 32), styles.brow(u, c.brow), leftBrowStyle]} />
        <Animated.View style={[styles.abs, at(55, 32), styles.brow(u, c.brow), rightBrowStyle]} />

        {/* noses, beaks, whiskers — over the face, under the mouth */}
        {kind.front && (
          <Svg width={size} height={118 * u} viewBox="0 0 100 118" style={styles.abs} pointerEvents="none">
            {kind.front()}
          </Svg>
        )}

        {/* mouth */}
        <View style={[styles.abs, at(33, 57)]}>
          <Svg width={34 * u} height={24 * u} viewBox="0 0 34 24">
            <AnimatedPath animatedProps={mouthProps} fill={BUDDY_COLORS.mouth} stroke={BUDDY_COLORS.ink} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
            <AnimatedEllipse animatedProps={tongueProps} cx={17} fill={BUDDY_COLORS.tongue} />
          </Svg>
        </View>

        {/* the child's favourite interest, worn as a badge on Pip's tummy */}
        {holdingUri && (
          <View style={[styles.abs, at(35, 70), { width: 30 * u, height: 30 * u, borderRadius: 15 * u, borderWidth: 2.2 * u, borderColor: "#FFFFFF", overflow: "hidden", backgroundColor: c.belly }]}>
            <Image source={{ uri: holdingUri }} style={{ width: "100%", height: "100%" }} />
          </View>
        )}

        {/* celebration sparkles */}
        {[
          [4, 8],
          [88, 4],
          [94, 40],
          [0, 44],
        ].map(([x, y]) => (
          <Animated.View key={`${x}-${y}`} style={[styles.abs, at(x, y), sparkleStyle]}>
            <Svg width={12 * u} height={12 * u} viewBox="0 0 24 24">
              <Path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill="#FFC83D" />
            </Svg>
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}

function Arm({ style, u, x, color, hand }: { style: object; u: number; x: number; color: string; hand: string }) {
  // A soft capsule hanging from the shoulder at (x, 52); rotates about its top.
  return (
    <Animated.View
      style={[
        styles.abs,
        {
          left: (x - 5) * u,
          top: 50 * u,
          width: 10 * u,
          height: 30 * u,
          borderRadius: 5 * u,
          backgroundColor: color,
          transformOrigin: "50% 12%",
        },
        style,
      ]}
    >
      <View style={{ position: "absolute", bottom: -1 * u, left: -1 * u, width: 12 * u, height: 12 * u, borderRadius: 6 * u, backgroundColor: hand }} />
    </Animated.View>
  );
}

const styles = {
  ...StyleSheet.create({ abs: { position: "absolute" } }),
  brow: (u: number, color: string) => ({ width: 14 * u, height: 2.8 * u, borderRadius: 1.4 * u, backgroundColor: color, transformOrigin: "50% 50%" }),
};
