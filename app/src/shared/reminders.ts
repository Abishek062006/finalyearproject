/**
 * A daily "time to learn" reminder for the grown-up (plan Phase 6) — a local
 * notification on this device at a time they choose. Short, regular
 * sessions at a predictable time suit autistic children best, and a
 * reminder is what makes "regular" actually happen.
 *
 * Phones only: browsers can't deliver scheduled notifications reliably.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export interface Reminder {
  enabled: boolean;
  hour: number; // 0-23, device local time
  minute: number;
}

const KEY = "aura.sessionReminder";
const DEFAULT: Reminder = { enabled: false, hour: 16, minute: 30 };

export const remindersSupported = Platform.OS !== "web";

if (remindersSupported) {
  // Show the reminder even if the app happens to be open at that moment.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function loadReminder(): Promise<Reminder> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/** Saves the choice and (re)schedules it. Returns false if notifications aren't allowed. */
export async function saveReminder(reminder: Reminder, childName?: string): Promise<boolean> {
  await AsyncStorage.setItem(KEY, JSON.stringify(reminder));
  if (!remindersSupported) return true;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!reminder.enabled) return true;
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Learning time",
      body: childName ? `A short session with ${childName}? Their buddy is ready.` : "A short learning session? The buddy is ready.",
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: reminder.hour, minute: reminder.minute },
  });
  return true;
}

export function useReminder() {
  const [reminder, setReminder] = useState<Reminder | null>(null);
  useEffect(() => {
    loadReminder().then(setReminder);
  }, []);
  return [reminder, setReminder] as const;
}

export function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
