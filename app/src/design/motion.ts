/**
 * Motion tokens. Everything interactive moves on springs (no linear
 * tweens), and every spring honours the OS "Reduce Motion" setting via
 * ReduceMotion.System — when it's on, Reanimated jumps straight to the end
 * value instead of animating.
 */
import { ReduceMotion, WithSpringConfig } from "react-native-reanimated";

export const springs = {
  /** Button / tile press-in and release. Quick, no overshoot. */
  press: { damping: 22, stiffness: 420, mass: 0.6, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
  /** Content settling into place (cards, sheets). */
  gentle: { damping: 24, stiffness: 190, mass: 1, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
  /** Child-space celebrations. Some overshoot — but still respects Reduce Motion. */
  playful: { damping: 12, stiffness: 180, mass: 0.9, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
};

export const durations = { fast: 150, normal: 250, slow: 400 } as const;

/** How far a pressable shrinks while held, per space. */
export const pressScale = { parent: 0.97, child: 0.94 } as const;
