"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { TimeSeriesPoint } from "@/lib/queries";

export function TimeSeriesChart({ data }: { data: TimeSeriesPoint[] }) {
  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleString("es-ES", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    occupancy: d.percentage,
  }));

  return (
    <ChartContainer config={{ occupancy: { label: "Aforo", color: "hsl(var(--chart-1))" } }} className="h-64 w-full">
      <LineChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey="occupancy" stroke="var(--color-occupancy)" dot={false} strokeWidth={2} />
      </LineChart>
    </ChartContainer>
  );
}
