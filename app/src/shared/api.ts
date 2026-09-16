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

export type InterventionType = "mini_game" | "interest_injection" | "modality_switch" | "break";

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
  is_intervention: boolean;
  intervention_type: InterventionType | null;
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
  retention_percent: number; // forgetting-curve estimate (docs/PLAN.md Phase 5), not raw mastery
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
  recommended_session_minutes: number | null;
}

export interface ConsentState {
  scope: string;
  granted: boolean;
  granted_at: string;
}

export interface EducatorLinkInfo {
  id: string;
  display_name: string;
  email: string;
  role: string;
}

// ---- Educator ----

export interface ArmEvidence {
  arm_code: string;
  label: string;
  trials: number;
  accuracy_percent: number;
  is_current_winner: boolean;
}

export interface AxisEvidence {
  axis_code: string;
  axis_label: string;
  arms: ArmEvidence[];
  winner_confidence: number | null;
  evidence_trials: number;
}

export interface EducatorChildProfile {
  child_id: string;
  nickname: string;
  domains: DomainProgress[];
  axes: AxisEvidence[];
}

export interface Topic {
  id: string;
  code: string;
  label: string;
  domain_id: string;
}

export interface LockState {
  axis_code: string;
  arm_code: string;
  allow: boolean;
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

  linkEducator: (childId: string, educatorEmail: string) =>
    request<EducatorLinkInfo>(`/parent/children/${childId}/educators`, {
      method: "POST",
      body: JSON.stringify({ educator_email: educatorEmail }),
    }),

  getEducators: (childId: string) => request<EducatorLinkInfo[]>(`/parent/children/${childId}/educators`),

  educatorListChildren: () => request<Child[]>("/educator/children"),

  educatorChildProfile: (childId: string) => request<EducatorChildProfile>(`/educator/children/${childId}/profile`),

  educatorListTopics: () => request<Topic[]>("/educator/topics"),

  educatorAssignTopic: (childId: string, topicCode: string) =>
    request<{ assigned: boolean }>(`/educator/children/${childId}/assign`, {
      method: "POST",
      body: JSON.stringify({ topic_code: topicCode }),
    }),

  educatorGetLocks: (childId: string) => request<LockState[]>(`/educator/children/${childId}/locks`),

  educatorSetLock: (childId: string, axisCode: string, armCode: string, allow: boolean) =>
    request<LockState>(`/educator/children/${childId}/locks`, {
      method: "POST",
      body: JSON.stringify({ axis_code: axisCode, arm_code: armCode, allow }),
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
    payload: { item_id: string | null; correct: boolean; response_time_ms: number; attempts?: number; hints_used?: number }
  ) =>
    request(`/sessions/activities/${activityInstanceId}/answer`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  endSession: (sessionId: string) =>
    request<Session>(`/sessions/${sessionId}/end`, { method: "POST" }),
};
