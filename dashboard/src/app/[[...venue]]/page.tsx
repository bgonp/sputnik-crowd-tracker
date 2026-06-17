import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { BarChart3, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveCards } from "@/components/LiveCards";
import { ChartSkeleton } from "@/components/ChartSkeleton";
import { ChartPlaceholder } from "@/components/ChartPlaceholder";
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
import type { Venue } from "@/lib/queries";

export const revalidate = 60;

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  // Optional catch-all: `/` → undefined, `/<slug>` → [slug].
  params: Promise<{ venue?: string[] }>;
  searchParams: Promise<SearchParams>;
}

// A param can arrive repeated, which Next surfaces as `string[]`; treat the
// unit as "absolute" when any of its values is, so behavior is deterministic.
const isAbsoluteUnit = (value: string | string[] | undefined): boolean =>
  Array.isArray(value) ? value.includes("absolute") : value === "absolute";

// Carry the incoming query string through the canonicalization redirect so
// attribution params (utm_*, etc.) survive for analytics. Drop the legacy
// `venue` key (it's now encoded in the path) and collapse `unit` to a single
// `unit=absolute`, since percentage is the default and isn't worth carrying.
function forwardedQuery(searchParams: SearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || key === "venue") continue;
    if (key === "unit") {
      if (isAbsoluteUnit(value)) params.set("unit", "absolute");
      continue;
    }
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// Give each venue its own indexable title/description and canonical URL.
// The root (no slug) is the all-venues overview, so it has no metadata of its
// own here and falls back to the generic site tags from the layout.
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

  // Legacy `/?venue=<id>` links (from the old query-param scheme) still
  // 308-redirect to their slug path so previously-indexed URLs keep working.
  // The bare domain no longer redirects — it renders the all-venues overview.
  // The venue list is only needed here and for slug resolution, so it's fetched
  // lazily; the bare `/` overview (the most-hit route) skips the query entirely.
  if ((!segments || segments.length === 0) && sp.venue !== undefined) {
    // Match a legacy id only when the whole value is an integer; pick the first
    // if the param is repeated. Anything else falls through to the overview.
    const rawVenueId = Array.isArray(sp.venue) ? sp.venue[0] : sp.venue;
    if (rawVenueId && /^\d+$/.test(rawVenueId)) {
      const venues = await getCachedVenues();
      const legacyVenue = venues.find((v) => v.id === Number(rawVenueId));
      if (legacyVenue) {
        permanentRedirect(`/${venueSlug(legacyVenue.name)}${forwardedQuery(sp)}`);
      }
    }
  }

  // On a venue path, resolve the slug (404 if unknown). The bare root has no
  // selected venue: it renders the live overview without the per-venue charts.
  let selectedVenue: Venue | undefined;
  if (segments && segments.length === 1) {
    const venues = await getCachedVenues();
    selectedVenue = findVenueBySlug(venues, segments[0]);
    if (!selectedVenue) notFound();
  }

  const now = process.env.MOCK_NOW ? new Date(process.env.MOCK_NOW) : new Date();
  // Round to 1-minute intervals so requests arriving milliseconds apart share a cache entry
  const roundedNow = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const roundedNowIso = roundedNow.toISOString();

  const [liveReadings, todayVisitorCounts] = await Promise.all([
    getCachedLiveReadings(),
    getCachedTodayVisitorCounts(roundedNowIso),
  ]);

  // Per-venue chart inputs (only consumed when a venue is selected).
  const unit: Unit = isAbsoluteUnit(sp.unit) ? "absolute" : "percentage";
  const selectedVenueName = selectedVenue ? shortVenueName(selectedVenue.name) : "";
  const currentReading = selectedVenue
    ? liveReadings.find((r) => r.venueId === selectedVenue.id)
    : undefined;
  const madridHour = selectedVenue
    ? parseInt(
        new Intl.DateTimeFormat("es-ES", {
          timeZone: "Europe/Madrid",
          hour: "2-digit",
          hour12: false,
        }).format(now)
      )
    : 0;

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
          <LiveCards readings={liveReadings} todayCounts={todayVisitorCounts} selectedId={selectedVenue?.id} />
        </Suspense>
      </section>

      <div className="grid gap-8 xl:grid-cols-2 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Mapa de calor{selectedVenueName && ` — ${selectedVenueName}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedVenue ? (
              <Suspense fallback={<ChartSkeleton className="h-48" />}>
                <HeatmapSection venueId={selectedVenue.id} />
              </Suspense>
            ) : (
              <ChartPlaceholder
                className="h-48"
                icon={<CalendarDays className="h-6 w-6" />}
                label="Selecciona un rocódromo arriba para ver su mapa de calor"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Media por hora{selectedVenueName && ` — ${selectedVenueName}`}
              </CardTitle>
              {selectedVenue && (
                <Suspense>
                  <UnitToggle unit={unit} />
                </Suspense>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedVenue ? (
              <Suspense fallback={<ChartSkeleton />}>
                <HourlySection
                  venueId={selectedVenue.id}
                  unit={unit}
                  currentHour={madridHour}
                  currentReading={currentReading}
                />
              </Suspense>
            ) : (
              <ChartPlaceholder
                icon={<BarChart3 className="h-6 w-6" />}
                label="Selecciona un rocódromo arriba para ver su media por hora"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
