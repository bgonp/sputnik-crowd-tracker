"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Unit } from "@/components/UnitToggle";
import type { HourlyBar } from "@/lib/queries";

export function HourlyChart({ data, unit }: { data: HourlyBar[]; unit: Unit }) {
  const isAbsolute = unit === "absolute";

  const chartData = data.map((d) => ({
    hour: `${String(d.hour).padStart(2, "0")}h`,
    value: isAbsolute ? d.avgOccupancy : d.avgPercentage,
    pct: d.avgPercentage,
    abs: d.avgOccupancy,
  }));

  return (
    <ChartContainer config={{ value: { label: "Aforo medio", color: "var(--chart-3)" } }} className="h-52 w-full">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
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
