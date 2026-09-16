/**
 * Offline answer queue (docs/ARCHITECTURE.md §8: "Events are written to a
 * local queue and uploaded with retry; every event carries a client-
 * generated UUID so replays are idempotent" — backend/app/services/
 * session_service.py's record_answer honors that id, docs/PLAN.md Phase 9).
 *
 * Scoped deliberately: this protects the thing that matters most if a
 * school tablet drops Wi-Fi mid-session — an already-answered item is never
 * lost or double-counted. It does NOT implement full prefetch-and-cache of
 * upcoming ActivitySpecs (the architecture doc's fuller offline vision) —
 * DecisionEngine.decide() picks the next activity adaptively from the
 * child's latest answer, so "the next activity" genuinely cannot be known
 * before that answer is recorded; a child who goes offline mid-session can
 * finish the activity they're already looking at (queued safely), but
 * fetching a NEW adaptive activity still needs connectivity, and the app
 * says so plainly rather than pretending otherwise.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "aura_offline_answer_queue_v1";

export interface AnswerPayload {
  item_id: string | null;
  correct: boolean;
  response_time_ms: number;
  attempts?: number;
  hints_used?: number;
}

interface QueuedAnswer {
  interactionId: string;
  activityInstanceId: string;
  payload: AnswerPayload;
  queuedAt: number;
}

function uuid(): string {
  // Not cryptographically strong — doesn't need to be. Only used as an
  // idempotency key the server already knows how to de-duplicate on.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function readQueue(): Promise<QueuedAnswer[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAnswer[]) : [];
  } catch {
    return []; // storage unavailable (e.g. private browsing) — degrade to "no offline support" rather than crash
  }
}

async function writeQueue(queue: QueuedAnswer[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // best-effort; nothing more to do locally if storage itself is unavailable
  }
}

export async function enqueueAnswer(activityInstanceId: string, payload: AnswerPayload, interactionId: string): Promise<void> {
  const queue = await readQueue();
  queue.push({ interactionId, activityInstanceId, payload, queuedAt: Date.now() });
  await writeQueue(queue);
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

/** Tries each queued answer in order (oldest first); stops at the first one
 * that still fails, so a genuinely offline stretch doesn't burn through
 * retries pointlessly and answers stay in their original order. */
export async function flushQueue(
  submit: (activityInstanceId: string, payload: AnswerPayload & { interaction_id: string }) => Promise<unknown>
): Promise<{ flushed: number; remaining: number }> {
  const queue = await readQueue();
  let i = 0;
  for (; i < queue.length; i++) {
    const item = queue[i];
    try {
      await submit(item.activityInstanceId, { ...item.payload, interaction_id: item.interactionId });
    } catch {
      break;
    }
  }
  const remaining = queue.slice(i);
  await writeQueue(remaining);
  return { flushed: i, remaining: remaining.length };
}

export function newInteractionId(): string {
  return uuid();
}
