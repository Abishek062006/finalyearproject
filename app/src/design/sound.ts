/**
 * Semantic UI sounds (assets/sounds/, synthesized in-house — no third-party
 * licensing). Like haptics.ts, callers name the event, not the file.
 *
 * UI sounds respect the device's silent switch and mix with other audio —
 * they are feedback, not content. Spoken prompts (Phase 2) are content and
 * will use a separate audio session policy.
 */
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { settingsStore } from "./settings";

export type SoundEvent = "tap" | "pop" | "success" | "nudge" | "unlock" | "celebrate";

const SOURCES: Record<SoundEvent, number> = {
  tap: require("../../assets/sounds/tap.wav"),
  pop: require("../../assets/sounds/pop.wav"),
  success: require("../../assets/sounds/success.wav"),
  nudge: require("../../assets/sounds/nudge.wav"),
  unlock: require("../../assets/sounds/unlock.wav"),
  celebrate: require("../../assets/sounds/celebrate.wav"),
};

const players: Partial<Record<SoundEvent, AudioPlayer>> = {};
let initialized = false;

export async function initSounds(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" });
  } catch {
    // web / unsupported — sounds still play with the platform default
  }
  (Object.keys(SOURCES) as SoundEvent[]).forEach((event) => {
    try {
      players[event] = createAudioPlayer(SOURCES[event]);
    } catch {
      // a missing player just means that one sound stays silent
    }
  });
}

export function playSound(event: SoundEvent): void {
  if (!settingsStore.get().soundEnabled || settingsStore.getSession().muteSounds) return;
  const player = players[event];
  if (!player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // never let feedback audio break an interaction
  }
}
