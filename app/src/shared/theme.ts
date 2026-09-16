/**
 * Design tokens for the child-facing UI. README §37: warm, friendly, modern,
 * calm — not overwhelming, not overly childish. Large touch targets, minimal
 * clutter, purposeful animation only (README §1, §31, §32).
 */
export const colors = {
  background: "#FFF8EE",
  surface: "#FFFFFF",
  primary: "#FF8A4C", // warm orange — used sparingly, not everywhere
  primaryDark: "#E8703A",
  success: "#4CAF7D",
  textPrimary: "#2E2A26",
  textSecondary: "#7A7369",
  cardShadow: "rgba(46, 42, 38, 0.12)",
  incorrectSoft: "#FFE3C9", // never red — README §31, no punitive feedback
};

export const spacing = {
  xs: 8,
  sm: 12,
  md: 20,
  lg: 32,
  xl: 48,
};

export const radius = {
  card: 28,
  button: 24,
};

export const typography = {
  prompt: 40,
  button: 32,
  guide: 22,
};

/** Minimum touch target per README §1 ("large touch targets"). */
export const MIN_TOUCH_TARGET = 88;

export type ThemeCode = "dino" | "space" | "ocean" | "cars";

export const THEME_ASSETS: Record<ThemeCode, { emoji: string; guideName: string; accent: string }> = {
  dino: { emoji: "🦖", guideName: "Rex", accent: "#7FB069" },
  space: { emoji: "🚀", guideName: "Astro", accent: "#5B6EE1" },
  ocean: { emoji: "🐠", guideName: "Splash", accent: "#3DA5D9" },
  cars: { emoji: "🚗", guideName: "Turbo", accent: "#E85D4E" },
};
