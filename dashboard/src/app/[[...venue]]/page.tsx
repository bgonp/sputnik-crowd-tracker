import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
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
import { shortVenueName, venueSlug, findVenueBySlug } from "@/lib/venues";
import {
  type SearchParams,
  isAbsoluteUnit,
  forwardedQuery,
  parseLegacyVenueId,
} from "@/lib/venue-routing";

export const revalidate = 60;

interface Props {
  // Optional catch-all: `/` → undefined, `/<slug>` → [slug].
  params: Promise<{ venue?: string[] }>;
  searchParams: Promise<SearchParams>;
}

// Give each venue its own indexable title/description and canonical URL.
// The root (no slug) redirects, so it has no metadata of its own here and
// falls back to the generic tags from the layout.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { venue: segments } = await params;
  if (!segments || segments.length !== 1) return {};

  const venues = await getCachedVenues();
  const selected = findVenueBySlug(venues, segments[0]);
  if (!selected) return {};

  const name = shortVenueName(selected.name);
  const title = `Aforo del rocódromo Sputnik ${name} en tiempo real`;
  const description = `Consulta el aforo en tiempo real, el histórico de ocupación y las mejores horas para visitar el rocódromo Sputnik ${name}.`;
  const canonical = `/${venueSlug(selected.name)}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
    twitter: { title, description },
  };
}

export default async function Home({ params, searchParams }: Props) {
  const { venue: segments } = await params;

  // Validate the path shape before any data work: anything deeper than a
  // single segment can't be a venue, so 404 without touching the DB.
  if (segments && segments.length > 1) notFound();

  const sp = await searchParams;
  const unit: Unit = isAbsoluteUnit(sp.unit) ? "absolute" : "percentage";

  const venues = await getCachedVenues();

  // Root URL: there's no venue in the path. Send legacy `/?venue=<id>` links
  // (still in the wild from the old query-param scheme) to their slug path, and
  // the bare domain to the default venue. Both are 308s so crawlers update.
  if (!segments || segments.length === 0) {
    const legacyId = parseLegacyVenueId(sp.venue);
    const legacyVenue =
      legacyId !== null ? venues.find((v) => v.id === legacyId) : undefined;
    const target = legacyVenue ?? venues[0];
    if (!target) notFound(); // empty DB — nothing to redirect to
    permanentRedirect(`/${venueSlug(target.name)}${forwardedQuery(sp)}`);
  }

  const selectedVenue = findVenueBySlug(venues, segments[0]);
  if (!selectedVenue) notFound();

  const selectedVenueId = selectedVenue.id;

  const now = process.env.MOCK_NOW ? new Date(process.env.MOCK_NOW) : new Date();
  // Round to 1-minute intervals so requests arriving milliseconds apart share a cache entry
  const roundedNow = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const roundedNowIso = roundedNow.toISOString();

  const [liveReadings, todayVisitorCounts] = await Promise.all([
    getCachedLiveReadings(),
    getCachedTodayVisitorCounts(roundedNowIso),
  ]);

  const currentReading = liveReadings.find((r) => r.venueId === selectedVenueId);
  const madridHour = parseInt(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hour12: false,
    }).format(now)
  );

  const selectedVenueName = shortVenueName(selectedVenue.name);

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
