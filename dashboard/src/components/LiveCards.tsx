"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyVisitorCount, LiveReading, VenueHours } from "@/lib/queries";
import { openStatusFor, type MadridMoment } from "@/lib/open-status";
import { shortVenueName, venueSlug } from "@/lib/venues";

function occupancyColor(pct: number): React.CSSProperties {
  const hue = 120 - Math.pow(pct / 100, 0.5) * 120;
  return { color: `hsl(${hue.toFixed(1)} 70% 45%)` };
}

interface Props {
  readings: LiveReading[];
  todayCounts: DailyVisitorCount[];
  // Per-venue opening hours; empty when not yet synced (venues then read as open).
  venueHours: VenueHours[];
  // Current Madrid moment, computed server-side so SSR and client agree.
  nowMoment: MadridMoment;
  // Undefined on the all-venues overview (`/`), where no card is highlighted.
  selectedId?: number;
}

export function LiveCards({ readings, todayCounts, venueHours, nowMoment, selectedId }: Props) {
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
        const status = openStatusFor(venueHours, r.venueId, nowMoment);
        return (
          <Card
            key={r.venueId}
            role="button"
            tabIndex={0}
            aria-label={`Ver gráficas de ${shortVenueName(r.venueName)}`}
            onClick={() => selectVenue(r.venueId, r.venueName)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectVenue(r.venueId, r.venueName);
              }
            }}
            className={`group cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? "ring-2 ring-primary" : "hover:border-primary/50 hover:shadow-md"} ${isLoading ? "opacity-70" : ""}`}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                {shortVenueName(r.venueName)}
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status.open ? (
                <>
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
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-muted-foreground">Cerrado</p>
                  {status.opensAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Abre a las {status.opensAt}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
