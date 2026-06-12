"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { HourlyBar } from "@/lib/queries";

export function HourlyChart({ data }: { data: HourlyBar[] }) {
  const chartData = data.map((d) => ({
    hour: `${String(d.hour).padStart(2, "0")}h`,
    occupancy: d.avgPercentage,
  }));

  return (
    <ChartContainer config={{ occupancy: { label: "Aforo medio", color: "var(--chart-3)" } }} className="h-52 w-full">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
        <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="occupancy" fill="var(--color-occupancy)" radius={2} />
      </BarChart>
    </ChartContainer>
  );
}
