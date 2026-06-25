"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { WeekdayFootfall } from "@/lib/queries";
import { occupancyColor } from "@/lib/occupancy-color";
import {
  buildWeekdayFootfallSeries,
  weekdayActivityScale,
  overallDailyAverage,
  type WeekdayFootfallDatum,
} from "@/lib/weekday-footfall";

export function WeekdayFootfallChart({
  data,
  todayWeekday,
}: {
  data: WeekdayFootfall[];
  todayWeekday?: number;
}) {
  const series = buildWeekdayFootfallSeries(data);
  // Quietest day → green, busiest → red, on the same scale as the heatmap, so
  // the best and worst days to visit pop out. null (no data / all tied) = muted.
  const scale = weekdayActivityScale(series);
  // Overall daily average (across all days, ignoring weekday) → reference line,
  // so each bar reads as above/below a typical day. null when there's no data.
  const overallAverage = overallDailyAverage(data);
  const barColor = (i: number): string => {
    const t = scale[i];
    return t == null ? "var(--muted-foreground)" : occupancyColor(t * 100);
  };

  const config = {
    avgVisitors: { label: "Visitantes", color: "var(--primary)" },
  };

  // Custom XAxis tick: today's label is bold + foreground with a small dot
  // underneath; all other days use the standard muted style.
  const xAxisTick = ({
    x,
    y,
    payload,
  }: {
    x: number;
    y: number;
    payload: { value: string; index: number };
  }) => {
    const isToday = todayWeekday !== undefined && payload.index === todayWeekday;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={12}
          textAnchor="middle"
          fontSize={11}
          fontWeight={isToday ? 600 : 400}
          fill={isToday ? "var(--foreground)" : "var(--muted-foreground)"}
        >
          {payload.value}
        </text>
        {isToday && <circle cx={0} cy={20} r={2} fill="var(--foreground)" />}
      </g>
    );
  };

  return (
    <div className="flex h-64 flex-col">
      <ChartContainer config={config} className="min-h-0 flex-1 w-full">
        <BarChart data={series} margin={{ top: 8, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" interval={0} tick={xAxisTick} height={28} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_label, payload) =>
                  (payload?.[0]?.payload as WeekdayFootfallDatum | undefined)?.fullLabel ?? ""
                }
                formatter={(_value, _name, item) => {
                  const d = item.payload as WeekdayFootfallDatum;
                  return (
                    <span className="flex w-full justify-between gap-3">
                      <span className="text-muted-foreground">Media de visitantes</span>
                      <span className="font-mono font-medium tabular-nums">
                        {d.hasData ? Math.round(d.avgVisitors) : "—"}
                      </span>
                    </span>
                  );
                }}
              />
            }
          />
          <Bar dataKey="avgVisitors" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {series.map((d, i) => (
              <Cell key={d.day} fill={barColor(i)} />
            ))}
          </Bar>
          {overallAverage != null && (
            <ReferenceLine
              y={overallAverage}
              stroke="var(--foreground)"
              strokeDasharray="4 3"
              label={{
                value: `media ${overallAverage}`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
          )}
        </BarChart>
      </ChartContainer>
      {/* Green→red activity legend, mirroring the heatmap's. */}
      <div className="flex items-center justify-center gap-2 pt-3 text-xs text-muted-foreground">
        <span>menos actividad</span>
        <div
          className="h-3 w-32 rounded-sm"
          style={{ background: "linear-gradient(to right, hsl(120 70% 60%), hsl(72 70% 60%), hsl(40 70% 60%), hsl(20 70% 60%), hsl(0 70% 60%))" }}
        />
        <span>más actividad</span>
      </div>
    </div>
  );
}
