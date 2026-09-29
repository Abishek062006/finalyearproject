/**
 * Which space a component is rendering in (Parent / Educator / Child) and
 * the resolved palette + type scale for it. Each navigator wraps its screens
 * in <SpaceProvider space=...>, so a shared component like <Button> looks
 * right wherever it's used without being told.
 *
 * Dark mode: the tokens and every design-system component already support
 * it, but app.json keeps userInterfaceStyle "light" until the Parent and
 * Educator screens themselves are rebuilt on these components (plan Phase 1
 * and 6) — the older screens still hard-code light colors in their own styles.
 */
import Constants from "expo-constants";
import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { HIT_TARGET, Palette, paletteFor, Scheme, Space, TextVariant, typeStyle } from "./tokens";

// app.json's userInterfaceStyle is the single dark-mode switch. Native
// platforms enforce it themselves, but web ignores it, so honour it here too.
const FORCED_SCHEME: Scheme | null =
  Constants.expoConfig?.userInterfaceStyle === "light" ? "light" : Constants.expoConfig?.userInterfaceStyle === "dark" ? "dark" : null;

export interface Theme {
  space: Space;
  scheme: Scheme;
  colors: Palette;
  type: (variant: TextVariant) => ReturnType<typeof typeStyle>;
  hitTarget: number;
}

const SpaceContext = createContext<Space>("parent");

export function SpaceProvider({ space, children }: { space: Space; children: React.ReactNode }) {
  return <SpaceContext.Provider value={space}>{children}</SpaceContext.Provider>;
}

export function useTheme(): Theme {
  const space = useContext(SpaceContext);
  const system = useColorScheme();
  const scheme: Scheme = FORCED_SCHEME ?? (system === "dark" ? "dark" : "light");
  return useMemo(
    () => ({
      space,
      scheme,
      colors: paletteFor(space, scheme),
      type: (variant: TextVariant) => typeStyle(space, variant),
      hitTarget: space === "child" ? HIT_TARGET.child : HIT_TARGET.parent,
    }),
    [space, scheme]
  );
}
