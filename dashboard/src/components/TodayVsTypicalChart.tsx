"use client";

import { useId } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { TodayVsTypicalPoint } from "@/lib/queries";
import { occupancyColor, occupancyGradientStops } from "@/lib/occupancy-color";
import { buildTodayVsTypicalSeries, type TodayVsTypicalDatum } from "@/lib/today-vs-typical";

// The day's line is colour-coded by occupancy (green→red), so its legend marker
// can't be a single swatch — show the scale as a small gradient chip instead.
function OccupancyLegendIcon() {
  return (
    <span
      className="inline-block h-2 w-3 shrink-0 rounded-[2px]"
      style={{ background: "linear-gradient(to right, hsl(120 70% 60%), hsl(0 70% 60%))" }}
    />
  );
}

interface Props {
  data: TodayVsTypicalPoint[];
  // Legend label for the primary line: "Hoy" for today, or a date for a past day.
  dayLabel: string;
  typicalLabel: string;
  // When plotting today, the live line stops at "now"; mark its tip with a dot
  // to call out the current occupancy. A past day is complete, so no dot.
  isToday: boolean;
}

export function TodayVsTypicalChart({ data, dayLabel, typicalLabel, isToday }: Props) {
  const chartData = buildTodayVsTypicalSeries(data);

  // The last point today's line reached = the current occupancy. (reduce, not
  // findLast, for older runtime targets.)
  const liveIndex = isToday
    ? chartData.reduce((last, d, i) => (d.todayPct != null ? i : last), -1)
    : -1;
  const livePoint = liveIndex >= 0 ? chartData[liveIndex] : null;

  // Colour the day's line on the same green→red occupancy scale as the heatmap,
  // so a tall (busy) stretch reads red and a quiet one green. A vertical SVG
  // gradient maps each height to its value's colour; `gradientUnits` defaults to
  // the line's bounding box, which runs highest-point (top) to lowest (bottom).
  const gradientId = useId();
  const gradientStops = occupancyGradientStops(chartData.map((d) => d.todayPct));

  // The x-axis is now per-minute (hundreds of points), so label only whole
  // hours — and every other hour when the open window is long — to keep it legible.
  const hourTicks = chartData.filter((d) => d.time.endsWith(":00")).map((d) => d.time);
  const tickStep = hourTicks.length > 8 ? 2 : 1;
  const ticks = hourTicks.filter((_, i) => i % tickStep === 0);

  // Keyed by each line's `dataKey` so both the tooltip (resolves by name) and the
  // legend (resolves by dataKey) find their label/colour — keying by a separate
  // series name leaves the legend label blank.
  const config = {
    todayPct: { label: dayLabel, color: "var(--chart-1)", icon: OccupancyLegendIcon },
    typicalPct: { label: typicalLabel, color: "var(--muted-foreground)" },
  };

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <LineChart data={chartData} margin={{ top: 8, right: 12 }}>
        {gradientStops.length > 0 && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              {gradientStops.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>
        )}
        <CartesianGrid vertical={false} />
        <XAxis dataKey="time" ticks={ticks} interval={0} tick={{ fontSize: 11 }} />
        <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} width={36} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(_value, name, item) => {
                const d = item.payload as TodayVsTypicalDatum;
                const isToday = name === "todayPct";
                const pct = isToday ? d.todayPct : d.typicalPct;
                const abs = isToday ? d.todayAbs : d.typicalAbs;
                const label = isToday ? dayLabel : typicalLabel;
                // `today` is null in buckets the day hasn't reached yet; show a
                // placeholder rather than an empty row (which reads as a glitch).
                return (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-medium tabular-nums">
                      {pct == null ? "—" : `${Math.round(pct)}% · ${Math.round(abs ?? 0)} pers.`}
                    </span>
                  </span>
                );
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {/* Baseline first so today's live line draws on top of it. Gaps are
            left unconnected so a missing baseline bucket isn't drawn as a value. */}
        <Line
          dataKey="typicalPct"
          name="typicalPct"
          type="monotone"
          stroke="var(--color-typicalPct)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          connectNulls={false}
          opacity={0.6}
          isAnimationActive={false}
        />
        {/* Short scrape gaps are bridged upstream in buildTodayVsTypicalSeries, so
            the live line reads continuous; long outages and the future stay null
            and break here (connectNulls stays false so they aren't drawn straight). */}
        <Line
          dataKey="todayPct"
          name="todayPct"
          type="monotone"
          stroke={gradientStops.length > 0 ? `url(#${gradientId})` : "var(--color-todayPct)"}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        {livePoint && (
          <ReferenceDot
            x={livePoint.time}
            y={livePoint.todayPct ?? 0}
            r={4}
            // Match the dot to its point's place on the occupancy scale.
            fill={occupancyColor(livePoint.todayPct ?? 0)}
            stroke="var(--background)"
            strokeWidth={2}
            ifOverflow="visible"
          />
        )}
      </LineChart>
    </ChartContainer>
  );
}
