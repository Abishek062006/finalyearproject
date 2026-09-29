/**
 * The buddy's voice — on-device text-to-speech (expo-speech: free, offline,
 * no account). Word-boundary events let the lip-sync controller re-align the
 * mouth to the real audio at every word (src/companion/useBuddy.ts).
 *
 * Speech is CONTENT (it's how a pre-reader gets instructions), not a UI
 * effect: a child with sound sensitivity still hears it, just more gently.
 * Only the device-level "Sounds" switch silences it — the buddy then still
 * mouths the words while the caption shows them.
 */
import * as Speech from "expo-speech";
import { settingsStore } from "../design/settings";

export interface SpeakCallbacks {
  onStart?: () => void;
  onBoundary?: (charIndex: number) => void;
  onDone?: () => void;
  /** The engine failed or was interrupted — the words were NOT (fully) heard. */
  onError?: () => void;
}

// Our own record of whether an utterance is in flight. Only then do we cancel
// before speaking: browsers fire an "interrupted" error on a NEW utterance
// queued right after cancel() lands on an idle engine (a real Chrome quirk
// that silenced every line spoken straight after another one).
let inFlight = 0;

/** Returns false if nothing will be heard (the caller should time the words itself). */
export function speak(text: string, cb: SpeakCallbacks = {}): boolean {
  if (!settingsStore.get().soundEnabled) return false;
  if (inFlight > 0) Speech.stop();
  inFlight += 1;
  let settled = false;
  const settle = (fn?: () => void) => {
    if (settled) return;
    settled = true;
    inFlight = Math.max(0, inFlight - 1);
    fn?.();
  };
  Speech.speak(text, {
    rate: 0.92,
    pitch: 1.15,
    volume: settingsStore.getSession().muteSounds ? 0.6 : 1,
    onStart: () => cb.onStart?.(),
    onBoundary: (ev: unknown) => {
      const index = (ev as { charIndex?: number })?.charIndex;
      if (typeof index === "number") cb.onBoundary?.(index);
    },
    onDone: () => settle(cb.onDone),
    onStopped: () => settle(cb.onDone),
    onError: () => settle(cb.onError ?? cb.onDone),
  });
  return true;
}

export function stopSpeaking(): void {
  if (inFlight > 0) Speech.stop();
  inFlight = 0;
}
