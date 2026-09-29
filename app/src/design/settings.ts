/**
 * Device-level app preferences (sound, haptics, developer overlay). A tiny
 * module store rather than React state alone, because non-React code —
 * haptics.ts and sound.ts, called from event handlers — must read the
 * current values synchronously. Persisted with AsyncStorage.
 *
 * Per-child sensory preferences (onboarding step 6) are a different thing:
 * those belong to the child's profile on the backend and arrive in Phase 1.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export interface AppSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  showDecisionOverlay: boolean; // research/debug strip in the child space — off by default, never child-facing
}

const STORAGE_KEY = "aura.settings.v1";
const DEFAULTS: AppSettings = { soundEnabled: true, hapticsEnabled: true, showDecisionOverlay: false };

let current: AppSettings = DEFAULTS;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const settingsStore = {
  get(): AppSettings {
    return current;
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
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSettings(): AppSettings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}
