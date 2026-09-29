/**
 * Pip's "brain": every value the drawing reads (mouth, eyes, brows, arms,
 * body) lives here as a Reanimated shared value, and screens drive the
 * character through a small verb API — say(), setMood(), gesture(),
 * lookAt(), enter(). The drawing itself (Buddy.tsx) is purely a function
 * of these values, so it never needs to know why it's moving.
 *
 * With reduceMotion (a child's sensory profile, or the OS setting) the body
 * stays still — no bobbing, hopping, walking or big arm swings — while the
 * face (blinks, mouth, expression) keeps working, since that's how the
 * character communicates.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelAnimation,
  Easing,
  SharedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { speak, stopSpeaking } from "../shared/speech";
import { buildTimeline, frameAt, MouthShape, REST } from "./lipSync";

export type Mood = "neutral" | "happy" | "excited" | "thinking" | "encouraging" | "concerned";
export type Gesture = "wave" | "point" | "pointLeft" | "clap" | "celebrate" | "nod";

const MOODS: Record<Mood, { smile: number; browY: number; browTilt: number; squint: number; tilt: number }> = {
  neutral: { smile: 0.55, browY: 0, browTilt: 0, squint: 1, tilt: 0 },
  happy: { smile: 1, browY: -0.6, browTilt: 0, squint: 0.82, tilt: 0 },
  excited: { smile: 1.25, browY: -1, browTilt: 0, squint: 0.9, tilt: 0 },
  thinking: { smile: 0.15, browY: -0.4, browTilt: -10, squint: 1, tilt: -4 },
  encouraging: { smile: 0.9, browY: -0.3, browTilt: 0, squint: 0.9, tilt: 5 },
  // Gentle and caring, never sad or cross — a wrong answer is not a failure (README §31).
  concerned: { smile: 0.3, browY: -0.3, browTilt: 12, squint: 1, tilt: 3 },
};

// Arm angles in degrees. Arms hang straight down at 0; positive = clockwise on
// screen. So the screen-LEFT arm swings outward with +, the screen-RIGHT arm with −.
const REST_ARMS = { left: 8, right: -8 };

export interface BuddyValues {
  mouthOpen: SharedValue<number>;
  mouthWidth: SharedValue<number>;
  mouthRound: SharedValue<number>;
  smile: SharedValue<number>;
  blink: SharedValue<number>;
  squint: SharedValue<number>;
  browY: SharedValue<number>;
  browTilt: SharedValue<number>;
  gazeX: SharedValue<number>;
  gazeY: SharedValue<number>;
  breathe: SharedValue<number>;
  hop: SharedValue<number>;
  tilt: SharedValue<number>;
  walkX: SharedValue<number>;
  appear: SharedValue<number>;
  armLeft: SharedValue<number>;
  armRight: SharedValue<number>;
  sparkle: SharedValue<number>;
}

export interface BuddyController {
  values: BuddyValues;
  caption: string | null;
  speaking: boolean;
  reduceMotion: boolean;
  say: (text: string, opts?: { mood?: Mood }) => Promise<void>;
  stop: () => void;
  setMood: (mood: Mood) => void;
  gesture: (g: Gesture) => void;
  lookAt: (x: number, y: number) => void;
  enter: () => void;
}

export function useBuddy({ reduceMotion = false }: { reduceMotion?: boolean } = {}): BuddyController {
  const v: BuddyValues = {
    mouthOpen: useSharedValue(0),
    mouthWidth: useSharedValue(1),
    mouthRound: useSharedValue(0),
    smile: useSharedValue(MOODS.neutral.smile),
    blink: useSharedValue(1),
    squint: useSharedValue(1),
    browY: useSharedValue(0),
    browTilt: useSharedValue(0),
    gazeX: useSharedValue(0),
    gazeY: useSharedValue(0),
    breathe: useSharedValue(0),
    hop: useSharedValue(0),
    tilt: useSharedValue(0),
    walkX: useSharedValue(0),
    appear: useSharedValue(1),
    armLeft: useSharedValue(REST_ARMS.left),
    armRight: useSharedValue(REST_ARMS.right),
    sparkle: useSharedValue(0),
  };
  const values = useRef(v).current;
  const [caption, setCaption] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const speech = useRef<{ timer: ReturnType<typeof setInterval> | null; resolve: (() => void) | null; token: number }>({ timer: null, resolve: null, token: 0 });

  // ---- Always-on life: breathing and blinking ----
  useEffect(() => {
    values.breathe.value = reduceMotion
      ? 0
      : withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);

    let blinkTimer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      blinkTimer = setTimeout(() => {
        const twice = Math.random() < 0.2;
        const one = withSequence(withTiming(0.08, { duration: 70 }), withTiming(1, { duration: 110 }));
        values.blink.value = twice ? withSequence(one, withDelay(90, one)) : one;
        scheduleBlink();
      }, 2200 + Math.random() * 3300);
    };
    scheduleBlink();
    return () => {
      clearTimeout(blinkTimer);
      cancelAnimation(values.breathe);
    };
  }, [reduceMotion, values]);

  // ---- Mouth ----
  const applyShape = useCallback(
    (s: MouthShape) => {
      const t = { duration: 60 };
      values.mouthOpen.value = withTiming(s.open, t);
      values.mouthWidth.value = withTiming(s.width, t);
      values.mouthRound.value = withTiming(s.round, t);
    },
    [values]
  );

  const finishSpeech = useCallback(
    (token: number) => {
      const s = speech.current;
      if (s.token !== token) return;
      if (s.timer) clearInterval(s.timer);
      s.timer = null;
      applyShape(REST);
      setSpeaking(false);
      const resolve = s.resolve;
      s.resolve = null;
      resolve?.();
    },
    [applyShape]
  );

  const stop = useCallback(() => {
    stopSpeaking();
    finishSpeech(speech.current.token);
  }, [finishSpeech]);

  const setMood = useCallback(
    (mood: Mood) => {
      const m = MOODS[mood];
      const spring = { damping: 16, stiffness: 160 };
      values.smile.value = withSpring(m.smile, spring);
      values.browY.value = withSpring(m.browY, spring);
      values.browTilt.value = withSpring(m.browTilt, spring);
      values.squint.value = withSpring(m.squint, spring);
      values.tilt.value = withSpring(reduceMotion ? 0 : m.tilt, spring);
    },
    [reduceMotion, values]
  );

  const say = useCallback(
    (text: string, opts: { mood?: Mood } = {}) => {
      // Interrupt whatever was being said — the newest line always wins.
      const prev = speech.current;
      if (prev.timer) clearInterval(prev.timer);
      prev.resolve?.();
      const token = prev.token + 1;
      speech.current = { timer: null, resolve: null, token };

      if (opts.mood) setMood(opts.mood);
      setCaption(text);
      setSpeaking(true);
      const { frames, duration } = buildTimeline(text);

      return new Promise<void>((resolve) => {
        speech.current.resolve = resolve;
        let start = Date.now();
        let offset = 0;
        let lastFrame = -1;
        let audible = false;

        const tick = () => {
          const t = Date.now() - start + offset;
          const frame = frameAt(frames, t);
          if (frame.at !== lastFrame) {
            lastFrame = frame.at;
            applyShape(frame.shape);
          }
          // Silent (sound off): the timeline itself decides when the line ends.
          // With audio, onDone decides — but never let a lost callback hang us.
          if (!audible && t > duration) finishSpeech(token);
          if (audible && t > duration + 4000) finishSpeech(token);
        };

        audible = speak(text, {
          onStart: () => {
            start = Date.now();
            offset = 0;
          },
          onBoundary: (charIndex) => {
            const frame = frames.find((f) => f.index >= charIndex);
            if (frame) offset = frame.at - (Date.now() - start);
          },
          onDone: () => finishSpeech(token),
          // The voice failed or was cut off: carry on mouthing the words on the
          // estimated timeline (the caption shows them) instead of freezing mid-line.
          onError: () => {
            audible = false;
          },
        });
        speech.current.timer = setInterval(tick, 40);
      });
    },
    [applyShape, finishSpeech, setMood]
  );

  const lookAt = useCallback(
    (x: number, y: number) => {
      values.gazeX.value = withSpring(Math.max(-1, Math.min(1, x)), { damping: 18 });
      values.gazeY.value = withSpring(Math.max(-1, Math.min(1, y)), { damping: 18 });
    },
    [values]
  );

  const gesture = useCallback(
    (g: Gesture) => {
      const rest = REST_ARMS;
      const swing = reduceMotion ? 0.5 : 1; // smaller movements when motion is reduced
      const spring = { damping: 12, stiffness: 140 };
      switch (g) {
        case "wave":
          values.armRight.value = withSequence(
            withSpring(-150, spring),
            withRepeat(withSequence(withTiming(-128, { duration: 170 }), withTiming(-162, { duration: 170 })), reduceMotion ? 1 : 3),
            withSpring(rest.right, spring)
          );
          break;
        case "point":
          values.armRight.value = withSequence(withSpring(-58, spring), withDelay(1400, withSpring(rest.right, spring)));
          break;
        case "pointLeft":
          values.armLeft.value = withSequence(withSpring(58, spring), withDelay(1400, withSpring(rest.left, spring)));
          break;
        case "clap": {
          const clap = (inward: number) => withRepeat(withSequence(withTiming(inward, { duration: 130 }), withTiming(inward * 0.2, { duration: 130 })), 3);
          values.armLeft.value = withSequence(clap(-38), withSpring(rest.left, spring));
          values.armRight.value = withSequence(clap(38), withSpring(rest.right, spring));
          break;
        }
        case "celebrate":
          values.armLeft.value = withSequence(withSpring(150 * swing, spring), withDelay(700, withSpring(rest.left, spring)));
          values.armRight.value = withSequence(withSpring(-150 * swing, spring), withDelay(700, withSpring(rest.right, spring)));
          values.sparkle.value = withSequence(withTiming(1, { duration: 260 }), withDelay(500, withTiming(0, { duration: 400 })));
          if (!reduceMotion) {
            const jump = withSequence(withTiming(-1, { duration: 170, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 190, easing: Easing.in(Easing.quad) }));
            values.hop.value = withSequence(jump, jump);
          }
          break;
        case "nod":
          values.tilt.value = withSequence(withTiming(-4, { duration: 120 }), withTiming(4, { duration: 160 }), withSpring(0, spring));
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduceMotion, values]
  );

  const enter = useCallback(() => {
    if (reduceMotion) {
      values.appear.value = 0;
      values.appear.value = withTiming(1, { duration: 400 });
      return;
    }
    // Walks (hops) in from the left and settles.
    values.walkX.value = -1.6;
    values.walkX.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) });
    const step = withSequence(withTiming(-0.35, { duration: 150 }), withTiming(0, { duration: 150 }));
    values.hop.value = withSequence(step, step, step);
  }, [reduceMotion, values]);

  useEffect(() => () => stop(), [stop]);

  return useMemo(
    () => ({ values, caption, speaking, reduceMotion, say, stop, setMood, gesture, lookAt, enter }),
    [values, caption, speaking, reduceMotion, say, stop, setMood, gesture, lookAt, enter]
  );
}
