/**
 * Pip, drawn entirely in code — a round, soft, friendly creature. Static
 * parts (body, ears, belly, cheeks, feet) are one SVG; moving parts (eyes,
 * brows, arms, mouth, sparkles) are separate layers driven by the shared
 * values in useBuddy.ts, so every motion runs on the UI thread.
 *
 * Designed in a 100 × 115 unit box and scaled to `size`. Purely decorative
 * for accessibility — what Pip says is always shown as text beside it.
 */
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedProps, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { BuddyController } from "./useBuddy";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

export const BUDDY_COLORS = {
  body: "#5CB8F2",
  bodyShade: "#3F9FDD",
  belly: "#E4F4FF",
  ink: "#1D2433",
  cheek: "#FF9FB5",
  mouth: "#6B2E3E",
  tongue: "#FF8FA6",
};

export function Buddy({ buddy, size = 140, holdingUri }: { buddy: BuddyController; size?: number; holdingUri?: string | null /* the interest badge */ }) {
  const u = size / 100; // one design unit in pixels
  const v = buddy.values;

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
        {/* arms sit BEHIND the body so the shoulder joint is hidden */}
        <Arm style={leftArmStyle} u={u} x={13} />
        <Arm style={rightArmStyle} u={u} x={87} />

        <Svg width={size} height={118 * u} viewBox="0 0 100 118" style={styles.abs}>
          <Ellipse cx={29} cy={17} rx={9} ry={11} fill={BUDDY_COLORS.bodyShade} />
          <Ellipse cx={71} cy={17} rx={9} ry={11} fill={BUDDY_COLORS.bodyShade} />
          <Ellipse cx={29} cy={18} rx={4.5} ry={6} fill={BUDDY_COLORS.cheek} opacity={0.55} />
          <Ellipse cx={71} cy={18} rx={4.5} ry={6} fill={BUDDY_COLORS.cheek} opacity={0.55} />
          <Ellipse cx={37} cy={104} rx={11} ry={6} fill={BUDDY_COLORS.bodyShade} />
          <Ellipse cx={63} cy={104} rx={11} ry={6} fill={BUDDY_COLORS.bodyShade} />
          <Path d="M50 12 C78 12 91 44 89 70 C87 93 71 104 50 104 C29 104 13 93 11 70 C9 44 22 12 50 12 Z" fill={BUDDY_COLORS.body} />
          <Path d="M50 16 C66 16 76 30 79 44 C70 30 60 24 50 24 C40 24 30 30 21 44 C24 30 34 16 50 16 Z" fill="#FFFFFF" opacity={0.18} />
          <Ellipse cx={50} cy={80} rx={25} ry={20} fill={BUDDY_COLORS.belly} />
          <Circle cx={27} cy={62} r={6.5} fill={BUDDY_COLORS.cheek} opacity={0.5} />
          <Circle cx={73} cy={62} r={6.5} fill={BUDDY_COLORS.cheek} opacity={0.5} />
        </Svg>

        {/* eyes */}
        {[38, 62].map((x) => (
          <Animated.View key={x} style={[styles.abs, at(x - 5.5, 40), { width: 11 * u, height: 14 * u, borderRadius: 6 * u, backgroundColor: BUDDY_COLORS.ink }, eyeStyle]}>
            <View style={{ position: "absolute", left: 5.8 * u, top: 2.2 * u, width: 3.6 * u, height: 3.6 * u, borderRadius: 2 * u, backgroundColor: "#FFFFFF" }} />
            <View style={{ position: "absolute", left: 3 * u, top: 8.5 * u, width: 1.8 * u, height: 1.8 * u, borderRadius: 1 * u, backgroundColor: "#FFFFFF", opacity: 0.7 }} />
          </Animated.View>
        ))}

        {/* brows */}
        <Animated.View style={[styles.abs, at(31, 32), styles.brow(u), leftBrowStyle]} />
        <Animated.View style={[styles.abs, at(55, 32), styles.brow(u), rightBrowStyle]} />

        {/* mouth */}
        <View style={[styles.abs, at(33, 57)]}>
          <Svg width={34 * u} height={24 * u} viewBox="0 0 34 24">
            <AnimatedPath animatedProps={mouthProps} fill={BUDDY_COLORS.mouth} stroke={BUDDY_COLORS.ink} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
            <AnimatedEllipse animatedProps={tongueProps} cx={17} fill={BUDDY_COLORS.tongue} />
          </Svg>
        </View>

        {/* the child's favourite interest, worn as a badge on Pip's tummy */}
        {holdingUri && (
          <View style={[styles.abs, at(35, 70), { width: 30 * u, height: 30 * u, borderRadius: 15 * u, borderWidth: 2.2 * u, borderColor: "#FFFFFF", overflow: "hidden", backgroundColor: BUDDY_COLORS.belly }]}>
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

function Arm({ style, u, x }: { style: object; u: number; x: number }) {
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
          backgroundColor: BUDDY_COLORS.bodyShade,
          transformOrigin: "50% 12%",
        },
        style,
      ]}
    >
      <View style={{ position: "absolute", bottom: -1 * u, left: -1 * u, width: 12 * u, height: 12 * u, borderRadius: 6 * u, backgroundColor: BUDDY_COLORS.body }} />
    </Animated.View>
  );
}

const styles = {
  ...StyleSheet.create({ abs: { position: "absolute" } }),
  brow: (u: number) => ({ width: 14 * u, height: 2.8 * u, borderRadius: 1.4 * u, backgroundColor: BUDDY_COLORS.ink, transformOrigin: "50% 50%" }),
};
