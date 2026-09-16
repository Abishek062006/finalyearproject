/**
 * Thin client for the FastAPI backend (backend/app/api/*).
 *
 * The child app renders whatever ActivitySpec it is given and reports back —
 * it makes no adaptation decisions itself (docs/ARCHITECTURE.md §6).
 */
import { Platform } from "react-native";

/**
 * Dev-only base URL resolution:
 *  - web / iOS simulator: the dev machine's own localhost works
 *  - Android emulator: 10.0.2.2 is the special alias for the host machine
 *  - a real tablet on the same Wi-Fi: replace with your machine's LAN IP
 * This becomes a proper build-time config (EAS / app.json "extra") once we
 * leave the vertical-slice stage — see docs/PLAN.md Phase 2 note.
 */
const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";
export const API_BASE = `http://${DEV_HOST}:8000`;

export interface Child {
  id: string;
  nickname: string;
  birth_year_month: string;
}

export interface Session {
  id: string;
  child_id: string;
  planned_minutes: number | null;
  end_reason: string | null;
}

export interface ActivityItem {
  id: string;
  answer: { count: number };
  distractors: number[];
}

export interface ActivitySpec {
  topic_id: string;
  topic_code: string;
  topic_reason: string;
  difficulty: number;
  method: "errorless" | "try_then_correct" | null;
  modality: "tap" | "drag_drop" | null;
  decision_types: Record<string, string | null>;
  theme: string;
  item_set_id: string | null;
  items: ActivityItem[];
}

export interface Activity {
  id: string;
  session_id: string;
  spec: ActivitySpec;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${options?.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  quickstartChild: () => request<Child>("/dev/quickstart", { method: "POST" }),

  startSession: (childId: string, plannedMinutes = 15) =>
    request<Session>("/sessions", {
      method: "POST",
      body: JSON.stringify({ child_id: childId, planned_minutes: plannedMinutes }),
    }),

  nextActivity: (sessionId: string) =>
    request<Activity>(`/sessions/${sessionId}/next-activity`),

  submitAnswer: (
    activityInstanceId: string,
    payload: { item_id: string; correct: boolean; response_time_ms: number; attempts?: number; hints_used?: number }
  ) =>
    request(`/sessions/activities/${activityInstanceId}/answer`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  endSession: (sessionId: string) =>
    request<Session>(`/sessions/${sessionId}/end`, { method: "POST" }),
};
