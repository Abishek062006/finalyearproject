/**
 * Small per-child lists that live only on this device (AsyncStorage), never
 * on the server — same privacy rule as childPhotos.ts:
 *
 * - Talk-board buttons the parent adds (a photo of the child's own cup,
 *   bike, grandma…): real photos of the child's home stay on the device.
 * - Which steps of today's visual schedule the child has ticked off: it
 *   only matters today, on the device the child is holding.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export interface TalkButton {
  id: string;
  label: string;
  photo: string; // small JPEG data URI
}

const talkKey = (childId: string) => `aura.talkButtons.${childId}`;
const doneKey = (childId: string) => `aura.scheduleDone.${childId}.${new Date().toISOString().slice(0, 10)}`;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function useStoredList<T>(key: string | null): [T[], (next: T[]) => Promise<void>] {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = () => readList<T>(key).then((v) => alive && setList(v));
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, [key]);
  const save = useCallback(
    async (next: T[]) => {
      if (!key) return;
      setList(next);
      await AsyncStorage.setItem(key, JSON.stringify(next));
      notify();
    },
    [key]
  );
  return [list, save];
}

export const MAX_TALK_BUTTONS = 12;

export function useTalkButtons(childId: string | undefined) {
  return useStoredList<TalkButton>(childId ? talkKey(childId) : null);
}

/** Ids of today's schedule steps the child has finished. Resets each day. */
export function useScheduleDone(childId: string | undefined) {
  return useStoredList<string>(childId ? doneKey(childId) : null);
}
