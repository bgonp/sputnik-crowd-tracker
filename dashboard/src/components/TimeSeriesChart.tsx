"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Unit } from "@/components/UnitToggle";
import type { TimeSeriesPoint } from "@/lib/queries";

export function TimeSeriesChart({ data, unit }: { data: TimeSeriesPoint[]; unit: Unit }) {
  const isAbsolute = unit === "absolute";
  const maxCapacity = Math.max(...data.map((d) => d.capacity), 0);

  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleString("es-ES", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    value: isAbsolute ? d.occupancy : d.percentage,
    pct: d.percentage,
    abs: d.occupancy,
  }));

  return (
    <ChartContainer config={{ value: { label: "Aforo", color: "var(--primary)" } }} className="h-64 w-full">
      <LineChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis
          unit={isAbsolute ? "" : "%"}
          domain={isAbsolute ? [0, maxCapacity || "auto"] : [0, 100]}
          tick={{ fontSize: 11 }}
        />
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
        <Line dataKey="value" stroke="var(--color-value)" dot={false} strokeWidth={2} />
      </LineChart>
    </ChartContainer>
  );
}
