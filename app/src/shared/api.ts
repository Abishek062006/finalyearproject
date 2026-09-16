/**
 * Thin client for the FastAPI backend (backend/app/api/*).
 *
 * The child app renders whatever ActivitySpec it is given and reports back —
 * it makes no adaptation decisions itself (docs/ARCHITECTURE.md §6).
 */
import { Platform } from "react-native";
import { authStore } from "./authStore";

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
  const token = authStore.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${options?.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---- Auth ----

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// ---- Parent ----

export interface DomainProgress {
  domain_code: string;
  domain_label: string;
  mastery_percent: number;
}

export interface TopicToReview {
  topic_id: string;
  topic_code: string;
  topic_label: string;
  mastery_percent: number;
}

export interface Recommendation {
  id: string;
  kind: string;
  payload: { message?: string; topic_label?: string; [key: string]: unknown };
  generated_at: string;
  response: string | null;
}

export interface SessionHistoryItem {
  id: string;
  started_at: string;
  ended_at: string | null;
  actual_minutes: number | null;
  end_reason: string | null;
}

export interface ChildSummary {
  learning_minutes_total: number;
  activities_completed: number;
  domains: DomainProgress[];
  topics_to_review: TopicToReview[];
  todays_suggestions: Recommendation[];
  recent_sessions: SessionHistoryItem[];
}

export interface ConsentState {
  scope: string;
  granted: boolean;
  granted_at: string;
}

export const api = {
  quickstartChild: () => request<Child>("/dev/quickstart", { method: "POST" }),

  register: (email: string, password: string, displayName: string, role: "parent" | "educator" = "parent") =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName, role }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: () => request<AuthUser>("/auth/me"),

  createChild: (nickname: string, birthYearMonth: string, initialInterests: string[]) =>
    request<Child>("/parent/children", {
      method: "POST",
      body: JSON.stringify({ nickname, birth_year_month: birthYearMonth, initial_interests: initialInterests }),
    }),

  listChildren: () => request<Child[]>("/parent/children"),

  childSummary: (childId: string) => request<ChildSummary>(`/parent/children/${childId}/summary`),

  respondToRecommendation: (recommendationId: string, response: "accepted" | "skipped") =>
    request<Recommendation>(`/parent/recommendations/${recommendationId}/respond`, {
      method: "POST",
      body: JSON.stringify({ response }),
    }),

  getConsent: (childId: string) => request<ConsentState[]>(`/parent/children/${childId}/consent`),

  setConsent: (childId: string, scope: string, granted: boolean) =>
    request<ConsentState>(`/parent/children/${childId}/consent`, {
      method: "POST",
      body: JSON.stringify({ scope, granted }),
    }),

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
