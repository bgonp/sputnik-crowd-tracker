"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyVisitorCount, LiveReading } from "@/lib/queries";
import { shortVenueName, venueSlug } from "@/lib/venues";

function occupancyColor(pct: number): React.CSSProperties {
  const hue = 120 - Math.pow(pct / 100, 0.5) * 120;
  return { color: `hsl(${hue.toFixed(1)} 70% 45%)` };
}

interface Props {
  readings: LiveReading[];
  todayCounts: DailyVisitorCount[];
  selectedId: number;
}

export function LiveCards({ readings, todayCounts, selectedId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const countByVenue = new Map(todayCounts.map((c) => [c.venueId, c.total]));

  // While a navigation transition is in flight, optimistically treat the
  // clicked venue as selected; otherwise the prop (URL-derived) is the source
  // of truth. Ignoring pendingId when not pending means we don't need a
  // setState-in-effect to reset it once the transition settles.
  const activeId = isPending && pendingId !== null ? pendingId : selectedId;

  function selectVenue(venueId: number, venueName: string) {
    if (venueId === activeId) return;
    setPendingId(venueId);
    startTransition(() => {
      // Navigate to the venue's slug path, preserving the unit toggle.
      const path = `/${venueSlug(venueName)}`;
      const unit = searchParams.get("unit");
      router.push(unit === "absolute" ? `${path}?unit=absolute` : path, {
        scroll: false,
      });
    });
  }

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
      {readings.map((r) => {
        const todayTotal = countByVenue.get(r.venueId);
        const isSelected = r.venueId === activeId;
        const isLoading = r.venueId === pendingId && isPending;
        return (
          <Card
            key={r.venueId}
            onClick={() => selectVenue(r.venueId, r.venueName)}
            className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"} ${isLoading ? "opacity-70" : ""}`}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                {shortVenueName(r.venueName)}
                {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
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
