/**
 * Everyday routines (plan Phase 5), used two ways: as a step-by-step guide
 * the child follows in real life (RoutineGuide), and as an ordering lesson
 * the engine serves (topic daily_routines). The lesson's steps come from the
 * backend's seed (backend/scripts/seed.py ROUTINES) — keep the two in sync.
 */
/** Pictures are emoji: they show the real object (a toothbrush, not a paintbrush). */
export interface Routine {
  code: string;
  label: string;
  picture: string;
  steps: { label: string; picture: string }[];
}

export const ROUTINES: Routine[] = [
  {
    code: "wash_hands",
    label: "Washing hands",
    picture: "🧼",
    steps: [
      { label: "Wet your hands", picture: "💧" },
      { label: "Use soap", picture: "🧼" },
      { label: "Dry your hands", picture: "👐" },
    ],
  },
  {
    code: "brush_teeth",
    label: "Brushing teeth",
    picture: "🪥",
    steps: [
      { label: "Put toothpaste on", picture: "🪥" },
      { label: "Brush all your teeth", picture: "🦷" },
      { label: "Spit it out", picture: "💦" },
      { label: "Rinse the brush", picture: "🚰" },
    ],
  },
  {
    code: "get_dressed",
    label: "Getting dressed",
    picture: "👕",
    steps: [
      { label: "Pants on", picture: "👖" },
      { label: "Shirt on", picture: "👕" },
      { label: "Socks on", picture: "🧦" },
      { label: "Shoes on", picture: "👟" },
      { label: "Coat on", picture: "🧥" },
    ],
  },
];
