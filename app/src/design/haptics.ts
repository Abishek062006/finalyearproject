/**
 * Semantic haptics: callers say WHAT happened ("drop", "success"), never
 * which motor pattern to fire, so the whole app's feel is tuned in one place.
 *
 * A wrong answer is deliberately a soft tap, never the "error" buzz — the
 * child space has no punitive feedback anywhere (README §31).
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { settingsStore } from "./settings";

export type HapticEvent = "tap" | "select" | "drop" | "success" | "gentleNudge" | "tick" | "unlock" | "warning";

const PLAYERS: Record<HapticEvent, () => Promise<void>> = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  select: () => Haptics.selectionAsync(),
  drop: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  gentleNudge: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  tick: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  unlock: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};

export function haptic(event: HapticEvent): void {
  if (Platform.OS === "web" || !settingsStore.get().hapticsEnabled) return;
  PLAYERS[event]().catch(() => {});
}
