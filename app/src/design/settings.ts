/**
 * Device-level app preferences (sound, haptics, developer overlay). A tiny
 * module store rather than React state alone, because non-React code —
 * haptics.ts and sound.ts, called from event handlers — must read the
 * current values synchronously. Persisted with AsyncStorage.
 *
 * Session overrides are separate and never persisted: while a child is in
 * the child space, THEIR sensory profile (set in onboarding) can mute sounds
 * or reduce motion on top of whatever the device settings are, and it's all
 * lifted again the moment they leave.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export interface AppSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  showDecisionOverlay: boolean; // research/debug strip in the child space — off by default, never child-facing
}

export interface SessionOverrides {
  muteSounds: boolean;
  reduceMotion: boolean;
}

const STORAGE_KEY = "aura.settings.v1";
const DEFAULTS: AppSettings = { soundEnabled: true, hapticsEnabled: true, showDecisionOverlay: false };
const NO_OVERRIDES: SessionOverrides = { muteSounds: false, reduceMotion: false };

let current: AppSettings = DEFAULTS;
let session: SessionOverrides = NO_OVERRIDES;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const settingsStore = {
  get(): AppSettings {
    return current;
  },
  getSession(): SessionOverrides {
    return session;
  },
  async hydrate(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) current = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      current = DEFAULTS;
    }
    emit();
  },
  set(patch: Partial<AppSettings>): void {
    current = { ...current, ...patch };
    emit();
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
  },
  setSession(overrides: Partial<SessionOverrides> | null): void {
    session = overrides ? { ...NO_OVERRIDES, ...overrides } : NO_OVERRIDES;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSettings(): AppSettings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}

export function useSessionOverrides(): SessionOverrides {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.getSession, settingsStore.getSession);
}
