/**
 * The companion's voice — on-device text-to-speech for now (expo-speech:
 * free, offline, no account). Phase 2 swaps in a warmer neural voice with
 * lip-sync timing; callers won't change.
 */
import * as Speech from "expo-speech";
import { settingsStore } from "../design/settings";

export function speak(text: string, opts: { onDone?: () => void } = {}): void {
  if (!settingsStore.get().soundEnabled || settingsStore.getSession().muteSounds) {
    opts.onDone?.();
    return;
  }
  Speech.stop();
  Speech.speak(text, { rate: 0.92, pitch: 1.1, onDone: opts.onDone, onStopped: opts.onDone, onError: () => opts.onDone?.() });
}

export function stopSpeaking(): void {
  Speech.stop();
}
