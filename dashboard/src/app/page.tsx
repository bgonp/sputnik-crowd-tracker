import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveCards } from "@/components/LiveCards";
import { ChartSkeleton } from "@/components/ChartSkeleton";
import { HeatmapSection } from "@/components/sections/HeatmapSection";
import { HourlySection } from "@/components/sections/HourlySection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AutoRefresh } from "@/components/AutoRefresh";
import { UnitToggle, type Unit } from "@/components/UnitToggle";
import {
  getCachedVenues,
  getCachedLiveReadings,
  getCachedTodayVisitorCounts,
} from "@/lib/cached-queries";

export const revalidate = 60;

interface Props {
  searchParams: Promise<{ venue?: string; unit?: string }>;
}

const shortVenueName = (name: string) => name.replace(" Principal", "");

// Give each venue its own indexable title/description and canonical URL.
// Without a `?venue=` param we inherit the generic metadata from the layout.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { venue } = await searchParams;
  if (!venue) return {};

  const venues = await getCachedVenues();
  const selected = venues.find((v) => v.id === parseInt(venue, 10));
  if (!selected) return {};

  const name = shortVenueName(selected.name);
  const title = `Aforo del rocódromo Sputnik ${name} en tiempo real`;
  const description = `Consulta el aforo en tiempo real, el histórico de ocupación y las mejores horas para visitar el rocódromo Sputnik ${name}.`;
  const canonical = `/?venue=${selected.id}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
    twitter: { title, description },
  };
}

export default async function Home({ searchParams }: Props) {
  const { venue, unit: unitParam } = await searchParams;
  const unit: Unit = unitParam === "absolute" ? "absolute" : "percentage";

  const now = process.env.MOCK_NOW ? new Date(process.env.MOCK_NOW) : new Date();
  // Round to 1-minute intervals so requests arriving milliseconds apart share a cache entry
  const roundedNow = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const roundedNowIso = roundedNow.toISOString();

  const [venues, liveReadings, todayVisitorCounts] = await Promise.all([
    getCachedVenues(),
    getCachedLiveReadings(),
    getCachedTodayVisitorCounts(roundedNowIso),
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

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);
  const selectedVenueName = selectedVenue ? shortVenueName(selectedVenue.name) : "";

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

      <div className="grid gap-8 xl:grid-cols-2 items-start">
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
      </div>
    </main>
  );
}
