/**
 * The ten learning friends, drawn in code. Every species shares ONE rig —
 * eyes centred at (38,47)/(62,47), brows at y≈33, lips at (50,63), shoulders
 * at (13,50)/(87,50), tummy badge at (35–65, 70–100) in a 100 × 118 box — so
 * the same animation, lip-sync and gesture code (useBuddy.ts / Buddy.tsx)
 * brings every one of them to life. A species only supplies artwork:
 *
 *   back  — behind the arms (tails, wings, spikes, antennae)
 *   body  — silhouette, ears, belly, cheeks, feet, face markings
 *   front — over the face but under the mouth (noses, beaks, whiskers)
 *
 * Codes must match the backend's BUDDY_SPECIES (app/models/identity.py).
 * Palettes are soft and low-contrast on purpose — nothing neon, nothing that
 * flashes (sensory-friendly by default).
 */
import React from "react";
import { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

export type SpeciesCode = "pip" | "kiko" | "bun" | "bao" | "luna" | "stompy" | "hoot" | "waddle" | "bolt" | "ember";

export interface Species {
  code: SpeciesCode;
  name: string;
  blurb: string;
  colors: {
    body: string;
    shade: string; // arms, feet, darker details
    belly: string;
    cheek: string;
    eye: string;
    brow: string;
    hand: string;
  };
  /** Light ring drawn behind each eye, for species whose eyes sit on dark markings. */
  eyeRing?: string;
  back?: () => React.ReactNode;
  body: () => React.ReactNode;
  front?: () => React.ReactNode;
}

const INK = "#1D2433";
const EGG = "M50 12 C78 12 91 44 89 70 C87 93 71 104 50 104 C29 104 13 93 11 70 C9 44 22 12 50 12 Z";
const SHINE = "M50 16 C66 16 76 30 79 44 C70 30 60 24 50 24 C40 24 30 30 21 44 C24 30 34 16 50 16 Z";

/** Mirror an x coordinate across the centre line — keeps left/right features symmetric. */
const mx = (x: number) => 100 - x;

function Cheeks({ color, opacity = 0.5 }: { color: string; opacity?: number }) {
  return (
    <G>
      <Circle cx={27} cy={62} r={6.5} fill={color} opacity={opacity} />
      <Circle cx={73} cy={62} r={6.5} fill={color} opacity={opacity} />
    </G>
  );
}

function Feet({ color, rx = 11 }: { color: string; rx?: number }) {
  return (
    <G>
      <Ellipse cx={37} cy={104} rx={rx} ry={6} fill={color} />
      <Ellipse cx={63} cy={104} rx={rx} ry={6} fill={color} />
    </G>
  );
}

function Nose({ color }: { color: string }) {
  return <Path d="M46.5 56.5 Q50 54 53.5 56.5 Q51.5 60 50 60.5 Q48.5 60 46.5 56.5 Z" fill={color} />;
}

export const SPECIES: Record<SpeciesCode, Species> = {
  pip: {
    code: "pip",
    name: "Pip",
    blurb: "A round, gentle friend",
    colors: { body: "#5CB8F2", shade: "#3F9FDD", belly: "#E4F4FF", cheek: "#FF9FB5", eye: INK, brow: INK, hand: "#5CB8F2" },
    body: () => (
      <G>
        <Ellipse cx={29} cy={17} rx={9} ry={11} fill="#3F9FDD" />
        <Ellipse cx={71} cy={17} rx={9} ry={11} fill="#3F9FDD" />
        <Ellipse cx={29} cy={18} rx={4.5} ry={6} fill="#FF9FB5" opacity={0.55} />
        <Ellipse cx={71} cy={18} rx={4.5} ry={6} fill="#FF9FB5" opacity={0.55} />
        <Feet color="#3F9FDD" />
        <Path d={EGG} fill="#5CB8F2" />
        <Path d={SHINE} fill="#FFFFFF" opacity={0.18} />
        <Ellipse cx={50} cy={80} rx={25} ry={20} fill="#E4F4FF" />
        <Cheeks color="#FF9FB5" />
      </G>
    ),
  },

  kiko: {
    code: "kiko",
    name: "Kiko",
    blurb: "A curious little fox",
    colors: { body: "#F2994A", shade: "#D97A2B", belly: "#FFF3E4", cheek: "#FF8F7A", eye: INK, brow: "#5A3A2E", hand: "#5A3A2E" },
    back: () => (
      <G>
        <Path d="M76 98 C93 96 99 78 94 60 C91 50 83 51 85 59 C89 73 85 86 70 91 Z" fill="#F2994A" />
        <Path d="M94 60 C91 50 83 51 85 59 C87 64 92 65 94 60 Z" fill="#FFF3E4" />
      </G>
    ),
    body: () => (
      <G>
        {[false, true].map((flip) => {
          const X = (x: number) => (flip ? mx(x) : x);
          return (
            <G key={String(flip)}>
              <Path d={`M${X(19)} 34 Q${X(20)} 8 ${X(27)} 4 Q${X(34)} 10 ${X(44)} 22 Z`} fill="#F2994A" />
              <Path d={`M${X(24)} 27 Q${X(25)} 15 ${X(28)} 12 Q${X(31)} 16 ${X(36)} 23 Z`} fill="#FFF3E4" />
              <Path d={`M${X(23)} 14 Q${X(25)} 6 ${X(27)} 4 Q${X(30)} 7 ${X(33)} 10 Z`} fill="#5A3A2E" />
            </G>
          );
        })}
        <Feet color="#5A3A2E" />
        <Path d={EGG} fill="#F2994A" />
        <Path d={SHINE} fill="#FFFFFF" opacity={0.16} />
        <Path d="M50 50 C62 50 73 56 75 64 C76 72 67 79 50 79 C33 79 24 72 25 64 C27 56 38 50 50 50 Z" fill="#FFF3E4" />
        <Ellipse cx={50} cy={88} rx={21} ry={14} fill="#FFF3E4" />
        <Cheeks color="#FF8F7A" opacity={0.45} />
      </G>
    ),
    front: () => <Nose color="#5A3A2E" />,
  },

  bun: {
    code: "bun",
    name: "Bun",
    blurb: "A soft, quiet bunny",
    colors: { body: "#D8CCF1", shade: "#BBA8E6", belly: "#FFFFFF", cheek: "#FFA8C2", eye: INK, brow: "#6E5A9E", hand: "#FFFFFF" },
    body: () => (
      <G>
        <Path d="M30 32 C23 14 25 0 34 1 C43 2 45 18 42 32 Z" fill="#D8CCF1" />
        <Path d="M32.5 29 C29 16 30 7 34 7 C38.5 8 39.5 19 38.5 29 Z" fill="#FFC2D4" />
        <Path d="M70 32 C77 14 75 0 66 1 C57 2 55 18 58 32 Z" fill="#D8CCF1" />
        <Path d="M67.5 29 C71 16 70 7 66 7 C61.5 8 60.5 19 61.5 29 Z" fill="#FFC2D4" />
        <Feet color="#FFFFFF" />
        <Path d="M50 22 C77 22 90 50 88 72 C86 93 71 104 50 104 C29 104 14 93 12 72 C10 50 23 22 50 22 Z" fill="#D8CCF1" />
        <Path d="M50 26 C64 26 74 36 78 48 C69 36 60 32 50 32 C40 32 31 36 22 48 C26 36 36 26 50 26 Z" fill="#FFFFFF" opacity={0.25} />
        <Ellipse cx={50} cy={82} rx={24} ry={19} fill="#FFFFFF" />
        <Cheeks color="#FFA8C2" opacity={0.55} />
      </G>
    ),
    front: () => <Nose color="#F28AA8" />,
  },

  bao: {
    code: "bao",
    name: "Bao",
    blurb: "A calm, cuddly panda",
    colors: { body: "#FFFFFF", shade: "#2D2D33", belly: "#F1F1EC", cheek: "#FFB3C7", eye: INK, brow: "#2D2D33", hand: "#2D2D33" },
    eyeRing: "#FFFFFF",
    body: () => (
      <G>
        <Circle cx={27} cy={19} r={10} fill="#2D2D33" />
        <Circle cx={73} cy={19} r={10} fill="#2D2D33" />
        <Feet color="#2D2D33" />
        <Path d={EGG} fill="#FFFFFF" stroke="#DADDE5" strokeWidth={1.2} />
        {/* classic teardrop patches, drooping outward */}
        <Path d="M31 41 C32 35 40 34.5 44.5 38.5 C47.5 42 46 50 41.5 54.5 C37 59 29 58 27.5 52.5 C26.5 48.5 29.5 45 31 41 Z" fill="#2D2D33" />
        <Path d="M69 41 C68 35 60 34.5 55.5 38.5 C52.5 42 54 50 58.5 54.5 C63 59 71 58 72.5 52.5 C73.5 48.5 70.5 45 69 41 Z" fill="#2D2D33" />
        <Ellipse cx={50} cy={82} rx={23} ry={18} fill="#F1F1EC" />
        <Cheeks color="#FFB3C7" opacity={0.55} />
      </G>
    ),
    front: () => <Nose color="#2D2D33" />,
  },

  luna: {
    code: "luna",
    name: "Luna",
    blurb: "A thoughtful grey cat",
    colors: { body: "#B7BFD0", shade: "#96A0B6", belly: "#F3F5FA", cheek: "#FFB0C4", eye: INK, brow: INK, hand: "#F3F5FA" },
    back: () => <Path d="M22 97 C5 95 2 73 10 60 C14 53 21 57 17 64 C12 73 15 85 27 89 Z" fill="#96A0B6" />,
    body: () => (
      <G>
        {[false, true].map((flip) => {
          const X = (x: number) => (flip ? mx(x) : x);
          return (
            <G key={String(flip)}>
              <Path d={`M${X(18)} 36 Q${X(20)} 8 ${X(26)} 5 Q${X(34)} 12 ${X(42)} 22 Z`} fill="#B7BFD0" />
              <Path d={`M${X(22.5)} 30 Q${X(24)} 15 ${X(27)} 11.5 Q${X(32)} 16 ${X(37)} 22.5 Z`} fill="#FFC4D2" />
            </G>
          );
        })}
        <Feet color="#96A0B6" />
        <Path d={EGG} fill="#B7BFD0" />
        <Path d={SHINE} fill="#FFFFFF" opacity={0.2} />
        <Path d="M44.5 19 Q46.5 25 45.5 29.5 M50 17 L50 27.5 M55.5 19 Q53.5 25 54.5 29.5" stroke="#8C96AD" strokeWidth={2.4} strokeLinecap="round" fill="none" />
        <Ellipse cx={50} cy={82} rx={24} ry={19} fill="#F3F5FA" />
        <Cheeks color="#FFB0C4" opacity={0.5} />
      </G>
    ),
    front: () => (
      <G>
        <Nose color="#F28AA8" />
        <G stroke={INK} strokeWidth={1.1} strokeLinecap="round" opacity={0.4}>
          <Line x1={31} y1={60} x2={15} y2={56} />
          <Line x1={31} y1={63} x2={14} y2={64} />
          <Line x1={31} y1={66} x2={16} y2={71} />
          <Line x1={69} y1={60} x2={85} y2={56} />
          <Line x1={69} y1={63} x2={86} y2={64} />
          <Line x1={69} y1={66} x2={84} y2={71} />
        </G>
      </G>
    ),
  },

  stompy: {
    code: "stompy",
    name: "Stompy",
    blurb: "A friendly little dinosaur",
    colors: { body: "#86CF75", shade: "#63B354", belly: "#F2F8D6", cheek: "#FF9F9F", eye: INK, brow: INK, hand: "#63B354" },
    back: () => (
      <G>
        <Path d="M78 97 C92 101 99 94 98 86 C97 81 92 83 89 86 C85 89 81 87 78 84 Z" fill="#86CF75" />
        <G fill="#F6B04A" strokeLinejoin="round" stroke="#F6B04A" strokeWidth={1.5}>
          <Path d="M27 23 L33 7 L40 18 Z" />
          <Path d="M40 15 L46 1 L52 13 Z" />
          <Path d="M48 13 L54 1 L60 15 Z" />
          <Path d="M60 18 L67 7 L73 23 Z" />
          <Path d="M81 38 L93 30 L88 46 Z" />
        </G>
      </G>
    ),
    body: () => (
      <G>
        <Feet color="#63B354" />
        <Path d={EGG} fill="#86CF75" />
        <Path d={SHINE} fill="#FFFFFF" opacity={0.18} />
        <Ellipse cx={50} cy={82} rx={24} ry={19} fill="#F2F8D6" />
        <Path d="M31 76 Q50 81 69 76 M29 84 Q50 89 71 84 M32 92 Q50 97 68 92" stroke="#D5E7A6" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Circle cx={30} cy={30} r={2} fill="#63B354" />
        <Circle cx={70} cy={28} r={2.4} fill="#63B354" />
        <Circle cx={64} cy={22} r={1.6} fill="#63B354" />
        <Cheeks color="#FF9F9F" opacity={0.45} />
      </G>
    ),
    front: () => (
      <G fill="#4E9A41">
        <Circle cx={46.5} cy={57.5} r={1.2} />
        <Circle cx={53.5} cy={57.5} r={1.2} />
      </G>
    ),
  },

  hoot: {
    code: "hoot",
    name: "Hoot",
    blurb: "A wise, cosy owl",
    colors: { body: "#B07F57", shade: "#8E623F", belly: "#F2E1C4", cheek: "#FFAF9A", eye: INK, brow: "#5E3F27", hand: "#8E623F" },
    body: () => (
      <G>
        <Path d="M19 32 Q16 10 29 12 Q33 20 37 25 Z" fill="#8E623F" />
        <Path d="M81 32 Q84 10 71 12 Q67 20 63 25 Z" fill="#8E623F" />
        <Ellipse cx={37} cy={105} rx={7} ry={4.5} fill="#F4A93C" />
        <Ellipse cx={63} cy={105} rx={7} ry={4.5} fill="#F4A93C" />
        <Path d={EGG} fill="#B07F57" />
        <Path d={SHINE} fill="#FFFFFF" opacity={0.14} />
        <Circle cx={38} cy={47} r={12} fill="#F7EBDD" />
        <Circle cx={62} cy={47} r={12} fill="#F7EBDD" />
        <Ellipse cx={50} cy={83} rx={24} ry={19} fill="#F2E1C4" />
        <Path d="M40 77 Q42 80 44 77 M56 77 Q58 80 60 77 M48 85 Q50 88 52 85 M40 93 Q42 96 44 93 M56 93 Q58 96 60 93" stroke="#C9A77C" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Cheeks color="#FFAF9A" opacity={0.4} />
      </G>
    ),
    front: () => <Path d="M46 53.5 L54 53.5 L50 60 Z" fill="#F4A93C" stroke="#F4A93C" strokeWidth={1.5} strokeLinejoin="round" />,
  },

  waddle: {
    code: "waddle",
    name: "Waddle",
    blurb: "A cheerful penguin",
    colors: { body: "#34405E", shade: "#242D45", belly: "#FFFFFF", cheek: "#FFA3B5", eye: INK, brow: INK, hand: "#242D45" },
    body: () => (
      <G>
        <Ellipse cx={37} cy={104} rx={10} ry={5.5} fill="#F6A23E" />
        <Ellipse cx={63} cy={104} rx={10} ry={5.5} fill="#F6A23E" />
        <Path d={EGG} fill="#34405E" />
        <Path d={SHINE} fill="#FFFFFF" opacity={0.12} />
        <Path d="M50 22 C66 22 76 32 75 44 C74 54 76 62 78 72 C80 88 70 101 50 101 C30 101 20 88 22 72 C24 62 26 54 25 44 C24 32 34 22 50 22 Z" fill="#FFFFFF" />
        <Cheeks color="#FFA3B5" opacity={0.55} />
      </G>
    ),
    front: () => <Path d="M45.5 55.5 Q50 52.5 54.5 55.5 Q52.5 60 50 61 Q47.5 60 45.5 55.5 Z" fill="#F6A23E" />,
  },

  bolt: {
    code: "bolt",
    name: "Bolt",
    blurb: "A helpful little robot",
    colors: { body: "#9CC7D6", shade: "#6E9FB2", belly: "#E6F3F7", cheek: "#FF9FB0", eye: INK, brow: "#3E6A7C", hand: "#E6F3F7" },
    back: () => (
      <G>
        <Line x1={50} y1={16} x2={50} y2={7} stroke="#6E9FB2" strokeWidth={2.6} strokeLinecap="round" />
        <Circle cx={50} cy={5.5} r={4.2} fill="#FFD25C" />
        <Circle cx={48.8} cy={4.3} r={1.2} fill="#FFFFFF" opacity={0.8} />
      </G>
    ),
    body: () => (
      <G>
        <Circle cx={12} cy={47} r={5.5} fill="#6E9FB2" />
        <Circle cx={88} cy={47} r={5.5} fill="#6E9FB2" />
        <Rect x={27} y={100} width={20} height={9} rx={4} fill="#6E9FB2" />
        <Rect x={53} y={100} width={20} height={9} rx={4} fill="#6E9FB2" />
        <Path d="M25 14 L75 14 Q86 14 86 25 L87 92 Q87 104 75 104 L25 104 Q13 104 13 92 L14 25 Q14 14 25 14 Z" fill="#9CC7D6" />
        <Path d="M25 18 L75 18 Q82 18 82 25 L82 28 Q66 22 50 22 Q34 22 18 28 L18 25 Q18 18 25 18 Z" fill="#FFFFFF" opacity={0.2} />
        <Rect x={20} y={29} width={60} height={45} rx={9} fill="#F4FCFF" stroke="#6E9FB2" strokeWidth={1.5} />
        <Rect x={29} y={78} width={42} height={22} rx={6} fill="#E6F3F7" />
        <Circle cx={40} cy={94} r={2.6} fill="#FF8A80" />
        <Circle cx={50} cy={94} r={2.6} fill="#7ED9A4" />
        <Circle cx={60} cy={94} r={2.6} fill="#FFD25C" />
        <Circle cx={27} cy={63} r={5} fill="#FF9FB0" opacity={0.45} />
        <Circle cx={73} cy={63} r={5} fill="#FF9FB0" opacity={0.45} />
      </G>
    ),
  },

  ember: {
    code: "ember",
    name: "Ember",
    blurb: "A kind little dragon",
    colors: { body: "#A58BE6", shade: "#8469D0", belly: "#F6ECFF", cheek: "#FF9FC0", eye: INK, brow: "#4B3A80", hand: "#8469D0" },
    back: () => (
      <G>
        <Path d="M17 56 C4 44 1 29 7 21 C10 29 15 31 19 33 C18 40 17 49 17 56 Z" fill="#C3B1F2" stroke="#8469D0" strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M83 56 C96 44 99 29 93 21 C90 29 85 31 81 33 C82 40 83 49 83 56 Z" fill="#C3B1F2" stroke="#8469D0" strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M79 96 C91 100 97 95 95 87 L99 83 L91 82.5 C89 88 85 90 79 88 Z" fill="#A58BE6" />
      </G>
    ),
    body: () => (
      <G>
        <Path d="M35 17 Q30 7 36 2 Q38 10 41 14.5 Z" fill="#FFE3A3" />
        <Path d="M65 17 Q70 7 64 2 Q62 10 59 14.5 Z" fill="#FFE3A3" />
        <Feet color="#8469D0" />
        <Path d={EGG} fill="#A58BE6" />
        <Path d={SHINE} fill="#FFFFFF" opacity={0.18} />
        <Ellipse cx={50} cy={82} rx={24} ry={19} fill="#F6ECFF" />
        <Path d="M31 76 Q50 81 69 76 M29 84 Q50 89 71 84 M32 92 Q50 97 68 92" stroke="#E2D2FA" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Cheeks color="#FF9FC0" opacity={0.5} />
      </G>
    ),
    front: () => (
      <G fill="#7A5FC4">
        <Circle cx={46.5} cy={57.5} r={1.2} />
        <Circle cx={53.5} cy={57.5} r={1.2} />
      </G>
    ),
  },
};

export const SPECIES_LIST: Species[] = Object.values(SPECIES);

export function speciesFor(code: string | null | undefined): Species {
  return SPECIES[(code as SpeciesCode) ?? "pip"] ?? SPECIES.pip;
}
