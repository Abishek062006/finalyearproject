/**
 * The countable things inside each theme — one small code-drawn picture per
 * theme (a dinosaur, a rocket, a fish, a race car), in the same flat, soft
 * style as the buddies. Drawn rather than photographed so five of them in a
 * basket read as five separate things, not one photo repeated.
 */
import React from "react";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { ThemeCode } from "../../shared/theme";

const INK = "#1D2433";

export function ThemeObject({ theme, size }: { theme: ThemeCode; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {theme === "dino" && <Dino />}
      {theme === "space" && <Rocket />}
      {theme === "ocean" && <Fish />}
      {theme === "cars" && <RaceCar />}
    </Svg>
  );
}

function Eye({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={3.6} fill={INK} />
      <Circle cx={x + 1.2} cy={y - 1.2} r={1.2} fill="#FFFFFF" />
    </G>
  );
}

function Dino() {
  return (
    <G>
      <Path d="M24 64 Q6 62 4 46 Q14 58 28 55 Z" fill="#6FB872" />
      <Path d="M32 45 L36 34 L41 44 Z M43 41 L47 30 L52 40 Z M53 41 L58 32 L62 43 Z" fill="#F2B544" />
      <Ellipse cx={48} cy={60} rx={28} ry={19} fill="#7BC47F" />
      <Path d="M60 50 Q64 38 72 38 L80 46 Q76 56 66 60 Z" fill="#7BC47F" />
      <Ellipse cx={73} cy={36} rx={16} ry={13} fill="#7BC47F" />
      <Ellipse cx={50} cy={66} rx={18} ry={9} fill="#A9DBA9" />
      <Rect x={33} y={70} width={10} height={17} rx={5} fill="#6FB872" />
      <Rect x={55} y={70} width={10} height={17} rx={5} fill="#6FB872" />
      <Circle cx={69} cy={42} r={3} fill="#F4A3A3" opacity={0.6} />
      <Eye x={77} y={32} />
      <Path d="M79 41 Q83 43.5 86 40" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
    </G>
  );
}

function Rocket() {
  return (
    <G>
      <Path d="M42 70 Q50 97 58 70 Z" fill="#F7B84B" />
      <Path d="M46 70 Q50 86 54 70 Z" fill="#FBE08A" />
      <Path d="M35 50 L21 72 L35 67 Z M65 50 L79 72 L65 67 Z" fill="#5B8DEF" />
      <Path d="M50 5 C65 18 69 40 66 66 L34 66 C31 40 35 18 50 5 Z" fill="#F4F6FA" stroke="#C9D2E0" strokeWidth={2} />
      <Path d="M50 5 C58 12 62 20 64 27 L36 27 C38 20 42 12 50 5 Z" fill="#5B8DEF" />
      <Circle cx={50} cy={41} r={8.5} fill="#8FD0FA" stroke="#5B8DEF" strokeWidth={3.5} />
      <Circle cx={47} cy={38} r={2.4} fill="#FFFFFF" opacity={0.8} />
      <Rect x={38} y={64} width={24} height={7} rx={3} fill="#C9D2E0" />
    </G>
  );
}

function Fish() {
  return (
    <G>
      <Path d="M22 52 L5 36 L8 68 Z" fill="#E8854A" />
      <Path d="M38 34 Q50 18 62 34 Z" fill="#E8854A" />
      <Ellipse cx={47} cy={52} rx={30} ry={20} fill="#F59E5B" />
      <Path d="M39 34 Q32 52 39 70 L46 71.5 Q39 52 46 32.5 Z" fill="#FFFFFF" />
      <Path d="M58 35 Q54 52 58 69 L62 67 Q58 52 62 37 Z" fill="#FFFFFF" opacity={0.85} />
      <Eye x={66} y={46} />
      <Path d="M76 56 Q73 59 69 57" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Circle cx={88} cy={30} r={4.5} fill="none" stroke="#7FC8F8" strokeWidth={2} />
      <Circle cx={83} cy={18} r={2.8} fill="none" stroke="#7FC8F8" strokeWidth={2} />
    </G>
  );
}

function RaceCar() {
  return (
    <G>
      <Path d="M7 48 L7 40 L19 40 L17 48 Z" fill="#3A6FD1" />
      <Path d="M8 66 L12 49 Q18 43 33 43 L45 34 Q51 30 62 32 L75 43 Q89 45 93 54 L93 66 Z" fill="#4F86E8" />
      <Path d="M40 43 L48 37 Q52 35 58 36 L66 43 Z" fill="#CFE8FB" />
      <Rect x={10} y={54} width={83} height={4.5} fill="#FFFFFF" opacity={0.85} />
      <Circle cx={28} cy={67} r={11} fill="#2E3440" />
      <Circle cx={28} cy={67} r={4.5} fill="#C9D2E0" />
      <Circle cx={75} cy={67} r={11} fill="#2E3440" />
      <Circle cx={75} cy={67} r={4.5} fill="#C9D2E0" />
    </G>
  );
}
