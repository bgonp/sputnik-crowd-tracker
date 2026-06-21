"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
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
  todayLabel: string;
  typicalLabel: string;
}

export function TodayVsTypicalChart({ data, todayLabel, typicalLabel }: Props) {
  const chartData = buildTodayVsTypicalSeries(data);

  const config = {
    today: { label: todayLabel, color: "var(--chart-1)" },
    typical: { label: typicalLabel, color: "var(--muted-foreground)" },
  };

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <LineChart data={chartData} margin={{ top: 8, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={7} minTickGap={24} />
        <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} width={36} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(_value, name, item) => {
                const d = item.payload as TodayVsTypicalDatum;
                const isToday = name === "today";
                const pct = isToday ? d.todayPct : d.typicalPct;
                const abs = isToday ? d.todayAbs : d.typicalAbs;
                const label = isToday ? todayLabel : typicalLabel;
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
          name="typical"
          type="monotone"
          stroke="var(--color-typical)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          connectNulls={false}
          opacity={0.6}
          isAnimationActive={false}
        />
        <Line
          dataKey="todayPct"
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
