import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyVisitorCount, LiveReading } from "@/lib/queries";

function occupancyColor(pct: number): string {
  if (pct < 40) return "text-green-600";
  if (pct < 70) return "text-yellow-500";
  return "text-red-500";
}

interface Props {
  readings: LiveReading[];
  todayCounts: DailyVisitorCount[];
}

export function LiveCards({ readings, todayCounts }: Props) {
  const countByVenue = new Map(todayCounts.map((c) => [c.venueId, c.total]));

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
      {readings.map((r) => {
        const todayTotal = countByVenue.get(r.venueId);
        return (
          <Card key={r.venueId}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {r.venueName.replace(" Principal", "")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${occupancyColor(r.percentage)}`}>
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
