import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveCards } from "@/components/LiveCards";
import { HeatmapChart } from "@/components/HeatmapChart";
import { HourlyChart } from "@/components/HourlyChart";
import { DailyChart } from "@/components/DailyChart";
import { TimeSeriesChart } from "@/components/TimeSeriesChart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UnitToggle, type Unit } from "@/components/UnitToggle";
import {
  getVenues,
  getLiveReadings,
  getTodayVisitorCounts,
  getHeatmap,
  getTimeSeries,
  getHourlyAverages,
  getDailyAverages,
} from "@/lib/queries";

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ venue?: string; unit?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const { venue, unit: unitParam } = await searchParams;
  const unit: Unit = unitParam === "absolute" ? "absolute" : "percentage";

  const [venues, liveReadings, todayVisitorCounts] = await Promise.all([
    getVenues(),
    getLiveReadings(),
    getTodayVisitorCounts(),
  ]);

  const defaultVenueId = venues[0]?.id ?? 1;
  const selectedVenueId = venue ? parseInt(venue, 10) : defaultVenueId;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const [heatmapData, timeSeriesData, hourlyData, dailyData] = await Promise.all([
    getHeatmap([selectedVenueId]),
    getTimeSeries(selectedVenueId, thirtyDaysAgo, now),
    getHourlyAverages([selectedVenueId]),
    getDailyAverages([selectedVenueId]),
  ]);

  const selectedVenueName =
    venues.find((v) => v.id === selectedVenueId)?.name.replace(" Principal", "") ?? "";

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sputnik Climbing</h1>
          <p className="text-muted-foreground text-sm">Seguimiento de aforo</p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense>
            <UnitToggle unit={unit} />
          </Suspense>
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
          <CardTitle className="text-base">
            Mapa de calor — {selectedVenueName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HeatmapChart data={heatmapData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Evolución del aforo — {selectedVenueName} (últimos 30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimeSeriesChart data={timeSeriesData} unit={unit} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Media por hora — {selectedVenueName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HourlyChart data={hourlyData} unit={unit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Media por día — {selectedVenueName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DailyChart data={dailyData} unit={unit} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
