"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyVisitorCount, LiveReading } from "@/lib/queries";

function occupancyColor(pct: number): React.CSSProperties {
  const hue = 120 - (pct / 100) * 120;
  return { color: `hsl(${hue} 70% 45%)` };
}

interface Props {
  readings: LiveReading[];
  todayCounts: DailyVisitorCount[];
  selectedId: number;
}

export function LiveCards({ readings, todayCounts, selectedId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const countByVenue = new Map(todayCounts.map((c) => [c.venueId, c.total]));

  function selectVenue(venueId: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("venue", String(venueId));
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
      {readings.map((r) => {
        const todayTotal = countByVenue.get(r.venueId);
        const isSelected = r.venueId === selectedId;
        return (
          <Card
            key={r.venueId}
            onClick={() => selectVenue(r.venueId)}
            className={`cursor-pointer transition-shadow ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"}`}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {r.venueName.replace(" Principal", "")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold" style={occupancyColor(r.percentage)}>
                {r.percentage}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {r.occupancy} / {r.capacity} personas
              </p>
              {todayTotal != null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {todayTotal} visitas hoy
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
