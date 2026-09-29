/**
 * The design system's raw values. Three "spaces" share one scale but not one
 * look: Parent and Educator follow Apple's platform conventions (system
 * font, grouped surfaces, one accent), while Child is calmer, rounder and
 * larger (README §1/§31/§37 — calm, predictable, big touch targets).
 *
 * Every color was chosen for WCAG AA contrast on its own surface — Apple's
 * pure systemBlue/systemGreen fail AA for small text on white, so the
 * accessible variants are used instead.
 */
import { Platform } from "react-native";

export type Space = "parent" | "educator" | "child";
export type Scheme = "light" | "dark";

export interface Palette {
  background: string;
  surface: string;
  surfaceElevated: string;
  fill: string; // subtle fill for chips, inputs, pressed rows
  separator: string;
  label: string;
  labelSecondary: string;
  labelTertiary: string;
  tint: string;
  tintPressed: string;
  tintSoft: string; // tinted-button background
  onTint: string;
  success: string;
  successSoft: string;
  destructive: string;
  destructiveSoft: string;
  shadow: string;
  overlay: string;
}

const parentLight: Palette = {
  background: "#F2F2F7",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  fill: "#E9E9EE",
  separator: "#C6C6C8",
  label: "#1D1D1F",
  labelSecondary: "#6E6E73",
  labelTertiary: "#AEAEB2",
  tint: "#0071E3",
  tintPressed: "#0058B0",
  tintSoft: "#E3EEFC",
  onTint: "#FFFFFF",
  success: "#248A3D",
  successSoft: "#E3F4E7",
  destructive: "#D70015",
  destructiveSoft: "#FDE7E9",
  shadow: "rgba(0,0,0,0.06)",
  overlay: "rgba(0,0,0,0.35)",
};

const parentDark: Palette = {
  background: "#000000",
  surface: "#1C1C1E",
  surfaceElevated: "#2C2C2E",
  fill: "#2C2C2E",
  separator: "#38383A",
  label: "#F5F5F7",
  labelSecondary: "#98989F",
  labelTertiary: "#636366",
  tint: "#409CFF",
  tintPressed: "#2E86E8",
  tintSoft: "#0A2540",
  onTint: "#FFFFFF",
  success: "#30D158",
  successSoft: "#0F2E18",
  destructive: "#FF6961",
  destructiveSoft: "#3A1414",
  shadow: "rgba(0,0,0,0)",
  overlay: "rgba(0,0,0,0.55)",
};

/** Child space: always light (a calm, bright "daytime" world), never dark. */
const child: Palette = {
  background: "#EEF3F9",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  fill: "#E4EAF2",
  separator: "#D5DDE8",
  label: "#1D2433",
  labelSecondary: "#5B6475",
  labelTertiary: "#9AA3B2",
  tint: "#0071E3",
  tintPressed: "#0058B0",
  tintSoft: "#DCEAFB",
  onTint: "#FFFFFF",
  success: "#248A3D",
  successSoft: "#E1F3E5",
  destructive: "#D70015",
  destructiveSoft: "#FDE7E9",
  shadow: "rgba(29,36,51,0.08)",
  overlay: "rgba(29,36,51,0.35)",
};

export function paletteFor(space: Space, scheme: Scheme): Palette {
  if (space === "child") return child;
  return scheme === "dark" ? parentDark : parentLight;
}

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Readable column width for tablets / web — content never stretches edge to edge. */
export const CONTENT_MAX_WIDTH = 640;

/** Apple HIG minimum is 44pt; the child space uses a far larger floor (README §1). */
export const HIT_TARGET = { parent: 44, child: 88 } as const;

// ---- Typography ----

export const childFontFamily = {
  regular: "Nunito_600SemiBold",
  bold: "Nunito_800ExtraBold",
} as const;

/** System font on every platform for Parent/Educator: SF Pro on iOS, Roboto on Android, system-ui on web. */
const systemFont = Platform.select({ web: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", default: undefined });

export type TextVariant =
  | "largeTitle"
  | "title1"
  | "title2"
  | "title3"
  | "headline"
  | "body"
  | "callout"
  | "subhead"
  | "footnote"
  | "caption";

interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: "400" | "500" | "600" | "700" | "800";
  letterSpacing?: number;
}

/** Apple's default Dynamic Type sizes (large), used verbatim for Parent/Educator. */
const parentType: Record<TextVariant, TypeStyle> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600", letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400", letterSpacing: -0.32 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: "400", letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: -0.08 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
};

/** Child sizes run roughly 1.4x larger, in a rounded face. */
const childType: Record<TextVariant, TypeStyle> = {
  largeTitle: { fontSize: 44, lineHeight: 52, fontWeight: "800" },
  title1: { fontSize: 36, lineHeight: 44, fontWeight: "800" },
  title2: { fontSize: 30, lineHeight: 38, fontWeight: "800" },
  title3: { fontSize: 26, lineHeight: 32, fontWeight: "800" },
  headline: { fontSize: 22, lineHeight: 28, fontWeight: "800" },
  body: { fontSize: 22, lineHeight: 30, fontWeight: "600" },
  callout: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  subhead: { fontSize: 18, lineHeight: 24, fontWeight: "600" },
  footnote: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
};

export function typeStyle(space: Space, variant: TextVariant) {
  if (space === "child") {
    const t = childType[variant];
    return {
      fontSize: t.fontSize,
      lineHeight: t.lineHeight,
      // Nunito ships as separate weight files — pick the file, don't synthesize weight.
      fontFamily: t.fontWeight === "800" ? childFontFamily.bold : childFontFamily.regular,
    };
  }
  const t = parentType[variant];
  return {
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    fontWeight: t.fontWeight,
    letterSpacing: Platform.OS === "ios" ? t.letterSpacing : undefined, // tracking values are SF-specific
    fontFamily: systemFont,
  };
}
