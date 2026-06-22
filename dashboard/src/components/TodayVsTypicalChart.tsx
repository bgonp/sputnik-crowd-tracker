"use client";

import { CartesianGrid, Line, LineChart, ReferenceDot, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { TodayVsTypicalPoint } from "@/lib/queries";
import { buildTodayVsTypicalSeries, type TodayVsTypicalDatum } from "@/lib/today-vs-typical";

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

  // The x-axis is now per-minute (hundreds of points), so label only whole
  // hours — and every other hour when the open window is long — to keep it legible.
  const hourTicks = chartData.filter((d) => d.time.endsWith(":00")).map((d) => d.time);
  const tickStep = hourTicks.length > 8 ? 2 : 1;
  const ticks = hourTicks.filter((_, i) => i % tickStep === 0);

  // Keyed by each line's `dataKey` so both the tooltip (resolves by name) and the
  // legend (resolves by dataKey) find their label/colour — keying by a separate
  // series name leaves the legend label blank.
  const config = {
    todayPct: { label: dayLabel, color: "var(--chart-1)" },
    typicalPct: { label: typicalLabel, color: "var(--muted-foreground)" },
  };

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <LineChart data={chartData} margin={{ top: 8, right: 12 }}>
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
        <Line
          dataKey="todayPct"
          name="todayPct"
          type="monotone"
          stroke="var(--color-todayPct)"
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
            fill="var(--color-todayPct)"
            stroke="var(--background)"
            strokeWidth={2}
            ifOverflow="visible"
          />
        )}
      </LineChart>
    </ChartContainer>
  );
}
