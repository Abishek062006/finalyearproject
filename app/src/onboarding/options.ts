/**
 * The answer options for every onboarding question, shared by the setup
 * flow and by later profile editing so the two can never disagree. Wording
 * is plain and non-clinical (README §2A) — "how does Rae usually
 * communicate", not a diagnostic scale.
 */
import { Ionicons } from "@expo/vector-icons";
import { CommunicationLevel, SensoryFlag } from "../shared/api";

type Icon = keyof typeof Ionicons.glyphMap;

export const COMMUNICATION_OPTIONS: { value: CommunicationLevel; title: string; subtitle: string; icon: Icon; color: string }[] = [
  { value: "sentences", title: "Full sentences", subtitle: "Talks in sentences most of the time", icon: "chatbubbles", color: "#0A84FF" },
  { value: "words", title: "Single words", subtitle: "Uses words or short phrases", icon: "chatbubble-ellipses", color: "#30B0C7" },
  { value: "gestures", title: "Gestures or pictures", subtitle: "Points, signs, or uses picture cards", icon: "hand-left", color: "#FF9F0A" },
  { value: "non_speaking", title: "Doesn't use speech yet", subtitle: "Communicates in other ways", icon: "heart", color: "#FF375F" },
];

export const SENSORY_OPTIONS: { value: SensoryFlag; title: string; short: string; subtitle: string; icon: Icon; color: string }[] = [
  { value: "sounds", title: "Loud or sudden sounds", short: "Sounds", subtitle: "We'll keep sound effects off in the child space", icon: "volume-high", color: "#FF375F" },
  { value: "lights", title: "Bright or flashing things", short: "Bright lights", subtitle: "We'll keep colours soft and nothing flashes", icon: "sunny", color: "#FF9F0A" },
  { value: "motion", title: "Fast movement on screen", short: "Motion", subtitle: "We'll slow animations down", icon: "speedometer", color: "#5E5CE6" },
  { value: "timers", title: "Being timed or rushed", short: "Timers", subtitle: "We'll never show countdowns", icon: "timer", color: "#30B0C7" },
];

/** Goal values are curriculum Domain codes (backend scripts/seed.py DOMAINS). */
export const GOAL_OPTIONS: { value: string; title: string; short: string; subtitle: string; icon: Icon; color: string; available: boolean }[] = [
  { value: "numeracy", short: "Numbers", title: "Numbers & counting", subtitle: "Counting, order, quantities", icon: "calculator", color: "#0A84FF", available: true },
  { value: "literacy", short: "Letters", title: "Letters & reading", subtitle: "Letters, sounds, first words", icon: "text", color: "#34C759", available: true },
  { value: "cognitive", short: "Shapes", title: "Colours, shapes & puzzles", subtitle: "Matching, sorting, problem solving", icon: "shapes", color: "#FF9F0A", available: false },
  { value: "social_emotional", short: "Feelings", title: "Feelings & calm", subtitle: "Emotions, calming down, turn-taking", icon: "happy", color: "#FF375F", available: false },
  { value: "functional", short: "Routines", title: "Daily routines", subtitle: "Brushing teeth, getting dressed", icon: "sunny", color: "#5E5CE6", available: false },
  { value: "communication", short: "Communication", title: "Communication", subtitle: "Asking for things, yes and no", icon: "chatbubbles", color: "#30B0C7", available: false },
];

export const INTEREST_SUGGESTIONS = ["Dinosaurs", "Trains", "Space", "Animals", "Cars", "Music", "Ocean", "Unicorns"];

export function communicationLabel(value: CommunicationLevel | null): string {
  return COMMUNICATION_OPTIONS.find((o) => o.value === value)?.title ?? "Not set";
}

export function sensoryLabel(values: SensoryFlag[]): string {
  if (values.length === 0) return "None";
  return values.map((v) => SENSORY_OPTIONS.find((o) => o.value === v)?.short ?? v).join(", ");
}

export function goalsLabel(values: string[]): string {
  if (values.length === 0) return "Everything";
  return values.map((v) => GOAL_OPTIONS.find((o) => o.value === v)?.short ?? v).join(", ");
}

export function ageInYears(birthYearMonth: string, now = new Date()): number {
  const [y, m] = birthYearMonth.split("-").map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m) age -= 1;
  return Math.max(0, age);
}
