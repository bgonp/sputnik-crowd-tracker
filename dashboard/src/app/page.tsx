import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveCards } from "@/components/LiveCards";
import { ChartSkeleton } from "@/components/ChartSkeleton";
import { HeatmapSection } from "@/components/sections/HeatmapSection";
import { TimeSeriesSection } from "@/components/sections/TimeSeriesSection";
import { HourlySection } from "@/components/sections/HourlySection";
import { DailySection } from "@/components/sections/DailySection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AutoRefresh } from "@/components/AutoRefresh";
import { UnitToggle, type Unit } from "@/components/UnitToggle";
import { getVenues, getLiveReadings, getTodayVisitorCounts } from "@/lib/queries";

export const revalidate = 60;

interface Props {
  searchParams: Promise<{ venue?: string; unit?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const { venue, unit: unitParam } = await searchParams;
  const unit: Unit = unitParam === "absolute" ? "absolute" : "percentage";

  const now = process.env.MOCK_NOW ? new Date(process.env.MOCK_NOW) : new Date();

  const [venues, liveReadings, todayVisitorCounts] = await Promise.all([
    getVenues(),
    getLiveReadings(),
    getTodayVisitorCounts(now),
  ]);

  const defaultVenueId = venues[0]?.id ?? 1;
  const selectedVenueId = venue ? parseInt(venue, 10) : defaultVenueId;

  const currentReading = liveReadings.find((r) => r.venueId === selectedVenueId);
  const madridHour = parseInt(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hour12: false,
    }).format(now)
  );

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const selectedVenueName =
    venues.find((v) => v.id === selectedVenueId)?.name.replace(" Principal", "") ?? "";

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <AutoRefresh intervalMs={60_000} />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sputnik Climbing</h1>
          <p className="text-muted-foreground text-sm">Seguimiento de aforo</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Aforo en tiempo real — todos los centros
        </h2>
        <Suspense>
          <LiveCards readings={liveReadings} todayCounts={todayVisitorCounts} selectedId={selectedVenueId} />
        </Suspense>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapa de calor — {selectedVenueName}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ChartSkeleton className="h-48" />}>
            <HeatmapSection venueId={selectedVenueId} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Evolución del aforo — {selectedVenueName} (últimos 30 días)
            </CardTitle>
            <Suspense>
              <UnitToggle unit={unit} />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ChartSkeleton />}>
            <TimeSeriesSection venueId={selectedVenueId} unit={unit} from={thirtyDaysAgo} to={nowIso} />
          </Suspense>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Media por hora — {selectedVenueName}</CardTitle>
              <Suspense>
                <UnitToggle unit={unit} />
              </Suspense>
            </div>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ChartSkeleton />}>
              <HourlySection
                venueId={selectedVenueId}
                unit={unit}
                currentHour={madridHour}
                currentReading={currentReading}
              />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Media por día — {selectedVenueName}</CardTitle>
              <Suspense>
                <UnitToggle unit={unit} />
              </Suspense>
            </div>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ChartSkeleton />}>
              <DailySection venueId={selectedVenueId} unit={unit} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
