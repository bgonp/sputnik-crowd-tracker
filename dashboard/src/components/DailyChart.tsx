"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DAY_LABELS } from "@/lib/labels";
import type { DailyBar } from "@/lib/queries";

export function DailyChart({ data }: { data: DailyBar[] }) {
  const chartData = data.map((d) => ({
    day: DAY_LABELS[d.day] ?? String(d.day),
    occupancy: d.avgPercentage,
  }));

  return (
    <ChartContainer config={{ occupancy: { label: "Aforo medio", color: "hsl(var(--chart-2))" } }} className="h-52 w-full">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="occupancy" fill="var(--color-occupancy)" radius={2} />
      </BarChart>
    </ChartContainer>
  );
}
