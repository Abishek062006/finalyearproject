/**
 * LEGACY token names, kept so screens not yet rebuilt on src/design keep
 * working — every value now comes from the design system (src/design/
 * tokens.ts), so old and new screens can't drift apart visually. New code
 * should use useTheme() from src/design instead of importing from here.
 */
import { childFontFamily, paletteFor } from "../design/tokens";

const parent = paletteFor("parent", "light");

export const colors = {
  background: parent.background,
  surface: parent.surface,
  surfaceMuted: parent.fill,
  border: parent.separator,
  primary: parent.tint,
  primaryDark: parent.tintPressed,
  success: parent.success,
  textPrimary: parent.label,
  textSecondary: parent.labelSecondary,
  cardShadow: parent.shadow,
  incorrectSoft: parent.fill, // a neutral nudge, never red or orange — README §31, no punitive feedback
  destructive: parent.destructive, // reserved for real destructive actions — never "wrong answer" feedback
};

/** Rounded child-space font files (loaded in App.tsx). */
export const childFonts = childFontFamily;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 20,
  lg: 32,
  xl: 48,
};

export const radius = {
  card: 20,
  button: 20,
};

export const typography = {
  prompt: 36,
  button: 28,
  guide: 19,
};

/** Minimum touch target per README §1 ("large touch targets"). */
export const MIN_TOUCH_TARGET = 88;

export type ThemeCode = "dino" | "space" | "ocean" | "cars";

/**
 * Real photographs (see assets/images/CREDITS.md for source/license), not
 * emoji or illustration — `accent` is a color sampled from each photo's own
 * palette so avatar/chip backgrounds feel considered rather than arbitrary.
 */
export const THEME_ASSETS: Record<ThemeCode, { image: number; guideName: string; accent: string }> = {
  dino: { image: require("../../assets/images/themes/dino.jpg"), guideName: "Rex", accent: "#8FBF6B" },
  space: { image: require("../../assets/images/themes/space.jpg"), guideName: "Astro", accent: "#6B7FA6" },
  ocean: { image: require("../../assets/images/themes/ocean.jpg"), guideName: "Splash", accent: "#E08A3C" },
  cars: { image: require("../../assets/images/themes/cars.jpg"), guideName: "Turbo", accent: "#8C8F94" },
};

/**
 * Classic ABC picture-mnemonics for MatchingBoard.tsx (letters_a_e_match,
 * docs/PLAN.md Phase B) — real photographs (assets/images/CREDITS.md),
 * decorative/frontend-only, not part of the content bank: unlike prompt
 * text there's no safety/tone review needed for "which picture represents
 * which letter".
 */
export const LETTER_MNEMONIC: Record<string, number> = {
  A: require("../../assets/images/letters/a_apple.jpg"),
  B: require("../../assets/images/letters/b_balloon.jpg"),
  C: require("../../assets/images/letters/c_cat.jpg"),
  D: require("../../assets/images/letters/d_dog.jpg"),
  E: require("../../assets/images/letters/e_egg.jpg"),
};
