/**
 * Text -> mouth-shape timeline. On-device TTS doesn't report phonemes, so
 * shapes come from the letters themselves (a handful of classic animation
 * "visemes": open A, wide E, round O, pursed U, closed M/B/P, teeth F/V),
 * timed by an estimated speaking rate. The speech engine's word-boundary
 * events then re-anchor the timeline to the real audio at every word, so
 * drift never builds up across a sentence.
 */
export interface MouthShape {
  open: number; // 0 closed … 1 wide open
  width: number; // 1 = neutral
  round: number; // 0 flat … 1 fully rounded
}

export const REST: MouthShape = { open: 0, width: 1, round: 0 };

const SHAPES: Record<string, MouthShape> = {
  A: { open: 0.85, width: 1.0, round: 0.1 },
  E: { open: 0.45, width: 1.15, round: 0 },
  I: { open: 0.32, width: 1.12, round: 0 },
  O: { open: 0.72, width: 0.8, round: 0.8 },
  U: { open: 0.35, width: 0.68, round: 1 },
  MBP: { open: 0, width: 0.86, round: 0 },
  FV: { open: 0.14, width: 1.02, round: 0 },
  L: { open: 0.38, width: 0.96, round: 0.1 },
  CONS: { open: 0.24, width: 0.95, round: 0.05 },
};

function shapeFor(ch: string): MouthShape | null {
  const c = ch.toLowerCase();
  if (c === "a") return SHAPES.A;
  if (c === "e") return SHAPES.E;
  if (c === "i" || c === "y") return SHAPES.I;
  if (c === "o") return SHAPES.O;
  if (c === "u" || c === "w" || c === "q") return SHAPES.U;
  if ("mbp".includes(c)) return SHAPES.MBP;
  if ("fv".includes(c)) return SHAPES.FV;
  if ("ltdnr".includes(c)) return SHAPES.L;
  if (/[a-z0-9]/.test(c)) return SHAPES.CONS;
  return null;
}

export interface Keyframe {
  at: number; // ms from the start of the utterance
  index: number; // character index in the text (for boundary re-sync)
  shape: MouthShape;
}

/** ~14 characters/second matches on-device voices at the rate speech.ts uses. */
export function buildTimeline(text: string, charsPerSecond = 14): { frames: Keyframe[]; duration: number } {
  const perChar = 1000 / charsPerSecond;
  const frames: Keyframe[] = [];
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const shape = shapeFor(ch);
    let dur = perChar;
    if (ch === " ") dur = perChar * 0.6;
    else if (ch === ",") dur = 220;
    else if (".!?".includes(ch)) dur = 380;
    const next = shape ?? REST;
    const prev = frames[frames.length - 1];
    if (!prev || prev.shape !== next) frames.push({ at: t, index: i, shape: next });
    t += dur;
  }
  frames.push({ at: t, index: text.length, shape: REST });
  return { frames, duration: t };
}

/** The keyframe in effect at time `t`. */
export function frameAt(frames: Keyframe[], t: number): Keyframe {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].at <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}
