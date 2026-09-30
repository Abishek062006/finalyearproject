/**
 * A day-by-day bar chart in the style of Apple Health: one rounded bar per
 * day measured from zero, today in the accent colour, a dashed line at the
 * average, and light gridlines. Days with nothing to show (no answers, for
 * a percentage) are left empty rather than drawn as zero.
 */
import React, { useState } from "react";
import { LayoutChangeEvent, Platform, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../design";

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
// SVG text doesn't inherit the app font on the web; use the system face everywhere.
const FONT = Platform.OS === "web" ? "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif" : undefined;

export function BarChart({
  days,
  values,
  unit,
  max,
  height = 180,
}: {
  days: string[]; // YYYY-MM-DD, oldest first
  values: (number | null)[];
  unit: string;
  max?: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const present = values.filter((v): v is number => v !== null);
  const top = Math.max(max ?? 0, ...present, 1);
  const avg = present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;

  const left = 4;
  const right = 40; // room for the axis labels
  const labelH = 20;
  const plotH = height - labelH - 8;
  const plotW = Math.max(0, width - left - right);
  const slot = values.length ? plotW / values.length : 0;
  const barW = Math.max(4, Math.min(22, slot * 0.62));
  const y = (v: number) => 8 + plotH - (v / top) * plotH;
  // Small ranges (e.g. under 10 minutes) need a decimal, or every gridline reads the same.
  const fmt = (v: number) => `${top < 10 ? Number(v.toFixed(1)) : Math.round(v)}${unit}`;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="image" accessibilityLabel={`Chart, average ${avg !== null ? fmt(avg) : "none"}`}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((f) => (
            <React.Fragment key={f}>
              <Line x1={left} x2={left + plotW} y1={y(top * f)} y2={y(top * f)} stroke={colors.separator} strokeWidth={1} />
              <SvgText fontFamily={FONT} x={width - 2} y={y(top * f) + 4} fontSize={11} fill={colors.labelTertiary} textAnchor="end">
                {fmt(top * f)}
              </SvgText>
            </React.Fragment>
          ))}
          {values.map((v, i) => {
            if (v === null || v <= 0) return null;
            const isToday = i === values.length - 1;
            const h = Math.max(3, 8 + plotH - y(v));
            return (
              <Rect
                key={days[i]}
                x={left + i * slot + (slot - barW) / 2}
                y={8 + plotH - h}
                width={barW}
                height={h}
                rx={Math.min(6, barW / 2)}
                fill={colors.tint}
                opacity={isToday ? 1 : 0.45}
              />
            );
          })}
          {avg !== null && (
            <>
              <Line x1={left} x2={left + plotW} y1={y(avg)} y2={y(avg)} stroke={colors.label} strokeWidth={1.25} strokeDasharray="4 4" opacity={0.6} />
              <SvgText fontFamily={FONT} x={left + 2} y={y(avg) - 5} fontSize={11} fontWeight="600" fill={colors.labelSecondary}>
                {`avg ${fmt(avg)}`}
              </SvgText>
            </>
          )}
          {days.map((d, i) => (
            <SvgText
              fontFamily={FONT}
              key={d}
              x={left + i * slot + slot / 2}
              y={height - 4}
              fontSize={11}
              fill={i === days.length - 1 ? colors.tint : colors.labelTertiary}
              fontWeight={i === days.length - 1 ? "700" : "400"}
              textAnchor="middle"
            >
              {WEEKDAY[new Date(`${d}T12:00:00`).getDay()]}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}
