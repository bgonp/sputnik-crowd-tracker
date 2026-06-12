"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DAY_LABELS } from "@/lib/labels";
import type { Unit } from "@/components/UnitToggle";
import type { DailyBar } from "@/lib/queries";

export function DailyChart({ data, unit }: { data: DailyBar[]; unit: Unit }) {
  const isAbsolute = unit === "absolute";

  const chartData = data.map((d) => ({
    day: DAY_LABELS[d.day] ?? String(d.day),
    value: isAbsolute ? d.avgOccupancy : d.avgPercentage,
    pct: d.avgPercentage,
    abs: d.avgOccupancy,
  }));

  return (
    <ChartContainer config={{ value: { label: "Aforo medio", color: "var(--chart-4)" } }} className="h-52 w-full">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis unit={isAbsolute ? "" : "%"} domain={isAbsolute ? [0, "auto"] : [0, 100]} tick={{ fontSize: 11 }} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(_value, _name, item) => {
                const { pct, abs } = item.payload as { pct: number; abs: number };
                return <span className="font-mono font-medium tabular-nums">{pct}% · {abs} pers.</span>;
              }}
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={2} />
      </BarChart>
    </ChartContainer>
  );
}
