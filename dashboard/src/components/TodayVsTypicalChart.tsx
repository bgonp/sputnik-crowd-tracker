"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { Unit } from "@/components/UnitToggle";
import type { TodayVsTypicalPoint } from "@/lib/queries";
import { buildTodayVsTypicalSeries } from "@/lib/today-vs-typical";

interface Props {
  data: TodayVsTypicalPoint[];
  unit: Unit;
  todayLabel: string;
  typicalLabel: string;
}

export function TodayVsTypicalChart({ data, unit, todayLabel, typicalLabel }: Props) {
  const isAbsolute = unit === "absolute";
  const chartData = buildTodayVsTypicalSeries(data, unit);
  const suffix = isAbsolute ? " pers." : "%";

  const config = {
    today: { label: todayLabel, color: "var(--chart-1)" },
    typical: { label: typicalLabel, color: "var(--muted-foreground)" },
  };

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <LineChart data={chartData} margin={{ top: 8, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={7} minTickGap={24} />
        <YAxis
          unit={isAbsolute ? "" : "%"}
          domain={isAbsolute ? [0, "auto"] : [0, 100]}
          tick={{ fontSize: 11 }}
          width={36}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                if (value == null) return null;
                const label = name === "today" ? todayLabel : typicalLabel;
                return (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-medium tabular-nums">
                      {Math.round(Number(value))}
                      {suffix}
                    </span>
                  </span>
                );
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {/* Baseline first so today's live line draws on top of it. */}
        <Line
          dataKey="typical"
          name="typical"
          type="monotone"
          stroke="var(--color-typical)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          connectNulls
          opacity={0.6}
          isAnimationActive={false}
        />
        <Line
          dataKey="today"
          name="today"
          type="monotone"
          stroke="var(--color-today)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
