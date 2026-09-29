/**
 * Thin client for the FastAPI backend (backend/app/api/*).
 *
 * The child app renders whatever ActivitySpec it is given and reports back —
 * it makes no adaptation decisions itself (docs/ARCHITECTURE.md §6).
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import { authStore } from "./authStore";
import { enqueueAnswer, flushQueue, newInteractionId, type AnswerPayload } from "./offlineQueue";

/**
 * Dev-only base URL resolution:
 *  - web / iOS simulator / Android emulator: the dev machine's own
 *    "localhost" (or, for the Android emulator specifically, its 10.0.2.2
 *    alias for the host machine) works, since those all run ON the dev
 *    machine or route back to it.
 *  - a REAL phone/tablet running this via Expo Go: "localhost" there means
 *    the phone itself, not the dev machine, so it must hit the dev
 *    machine's LAN IP instead. Metro already knows that IP — it's the same
 *    host the phone just fetched this JS bundle from — so `hostUri` (from
 *    expo-constants) reads it back rather than requiring a hardcoded IP.
 * This becomes a proper build-time config (EAS / app.json "extra") once we
 * leave the vertical-slice stage — see docs/PLAN.md Phase 2 note.
 */
function resolveDevHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") return host;
  return Platform.OS === "android" ? "10.0.2.2" : "localhost";
}

const DEV_HOST = resolveDevHost();
export const API_BASE = `http://${DEV_HOST}:8000`;

export type CommunicationLevel = "sentences" | "words" | "gestures" | "non_speaking";
export type SensoryFlag = "sounds" | "lights" | "motion" | "timers";

export interface ChildInterest {
  id: string;
  label: string;
  image_url: string;
  is_favourite: boolean;
}

export interface Child {
  id: string;
  nickname: string;
  birth_year_month: string;
  companion_name: string | null;
  companion_image_url: string | null;
  communication_level: CommunicationLevel | null;
  sensory: SensoryFlag[];
  goals: string[]; // curriculum Domain codes
  interests: ChildInterest[];
}

export interface OnboardInterest {
  label: string;
  image_url: string;
  source_title: string;
  favourite: boolean;
}

export interface OnboardChildRequest {
  nickname: string;
  birth_year_month: string;
  communication_level: CommunicationLevel | null;
  sensory: SensoryFlag[];
  goals: string[];
  interests: OnboardInterest[];
}

export type ChildProfilePatch = Partial<Pick<Child, "nickname" | "birth_year_month" | "communication_level" | "sensory" | "goals">>;

export interface Session {
  id: string;
  child_id: string;
  planned_minutes: number | null;
  end_reason: string | null;
}

export type ActivityKind = "counting" | "letter_identify" | "matching" | "sequencing" | "intervention";

export interface ActivityItem {
  id: string;
  // "counting" -> { count }; "letter_identify" / "matching" -> { label };
  // "sequencing" -> { value, position }. Which shape applies is decided by
  // ActivitySpec.activity_kind, not by inspecting the item itself.
  answer: { count: number } | { label: string } | { value: number; position: number };
  distractors: (number | string)[];
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
  activity_kind: ActivityKind;
  // For "letter_identify", may contain a "{label}" placeholder each item
  // fills in with its own target letter (content/generator's
  // identify_prompt_template) — from the offline content bank
  // (docs/PLAN.md Phase 7), not hardcoded.
  prompt_text: string;
  encouragement: string[];
  guide_name: string;
  companion_image_url: string | null; // set only when the child has a parent-chosen companion (docs/PLAN.md UX-overhaul Phase C)
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

export interface InterestSummary {
  theme_code: string;
  theme_label: string;
  level: "high_interest" | "steady" | "still_building" | "still_discovering";
}

export interface ChildSummary {
  learning_minutes_total: number;
  activities_completed: number;
  domains: DomainProgress[];
  topics_to_review: TopicToReview[];
  interests: InterestSummary[];
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

// ---- Companion (docs/PLAN.md UX-overhaul Phase C) ----

export interface CompanionCandidate {
  image_url: string;
  thumb_url: string | null; // small version for display; image_url is what the server downloads
  source_title: string;
  license: string;
}

export interface CompanionResult {
  companion_name: string;
  companion_image_url: string;
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

  getChild: (childId: string) => request<Child>(`/parent/children/${childId}`),

  searchInterests: (query: string) =>
    request<CompanionCandidate[]>("/parent/interests/search", { method: "POST", body: JSON.stringify({ query }) }),

  onboardChild: (payload: OnboardChildRequest) =>
    request<Child>("/parent/children/onboard", { method: "POST", body: JSON.stringify(payload) }),

  updateChild: (childId: string, patch: ChildProfilePatch) =>
    request<Child>(`/parent/children/${childId}`, { method: "PATCH", body: JSON.stringify(patch) }),

  addInterest: (childId: string, interest: OnboardInterest) =>
    request<Child>(`/parent/children/${childId}/interests`, { method: "POST", body: JSON.stringify(interest) }),

  favouriteInterest: (childId: string, interestId: string) =>
    request<Child>(`/parent/children/${childId}/interests/${interestId}/favourite`, { method: "POST" }),

  removeInterest: (childId: string, interestId: string) =>
    request<Child>(`/parent/children/${childId}/interests/${interestId}`, { method: "DELETE" }),

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

  exportChildData: (childId: string) => request<Record<string, unknown>>(`/parent/children/${childId}/export`),

  withdrawAndDeleteChild: (childId: string) =>
    request<{ deleted: boolean }>(`/parent/children/${childId}`, { method: "DELETE" }),

  searchCompanion: (childId: string, query: string) =>
    request<CompanionCandidate[]>(`/parent/children/${childId}/companion/search`, {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  confirmCompanion: (childId: string, query: string, imageUrl: string, sourceTitle: string) =>
    request<CompanionResult>(`/parent/children/${childId}/companion/confirm`, {
      method: "POST",
      body: JSON.stringify({ query, image_url: imageUrl, source_title: sourceTitle }),
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

  submitAnswer: (activityInstanceId: string, payload: AnswerPayload & { interaction_id?: string }) =>
    request(`/sessions/activities/${activityInstanceId}/answer`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  endSession: (sessionId: string) =>
    request<Session>(`/sessions/${sessionId}/end`, { method: "POST" }),

  /**
   * Offline-safe answer submission (docs/ARCHITECTURE.md §8, docs/PLAN.md
   * Phase 9): never throws. A network failure queues the answer locally
   * (AsyncStorage) under a client-generated interaction_id instead of
   * losing it; the backend's record_answer treats a resend of the same id
   * as a no-op, so a queued answer can be retried safely even if the
   * original request actually landed before the connection dropped.
   */
  submitAnswerReliably: async (activityInstanceId: string, payload: AnswerPayload): Promise<void> => {
    const interactionId = newInteractionId();
    try {
      await api.submitAnswer(activityInstanceId, { ...payload, interaction_id: interactionId });
    } catch {
      await enqueueAnswer(activityInstanceId, payload, interactionId);
    }
    // Opportunistic, non-blocking: try to clear anything queued from an
    // earlier drop. Never awaited by the caller — a slow/failing flush must
    // not stall the child's next tap.
    flushQueue((id, p) => api.submitAnswer(id, p)).catch(() => {});
  },
};
