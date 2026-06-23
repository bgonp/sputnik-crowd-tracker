import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { CalendarDays, LineChart, BarChart3, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveCards } from "@/components/LiveCards";
import { ChartSkeleton } from "@/components/ChartSkeleton";
import { ChartPlaceholder } from "@/components/ChartPlaceholder";
import { HeatmapSection } from "@/components/sections/HeatmapSection";
import { TodayVsTypicalSection } from "@/components/sections/TodayVsTypicalSection";
import { WeekdayFootfallSection } from "@/components/sections/WeekdayFootfallSection";
import { TodayVsTypicalChart } from "@/components/TodayVsTypicalChart";
import { HeatmapChart } from "@/components/HeatmapChart";
import { WeekdayFootfallChart } from "@/components/WeekdayFootfallChart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AutoRefresh } from "@/components/AutoRefresh";
import {
  getCachedVenues,
  getCachedVenueHours,
  getCachedLiveReadings,
  getCachedTodayVisitorCounts,
  getCachedDatesWithData,
} from "@/lib/cached-queries";
import { madridMoment, openWindowFor, anyVenueOpenAt } from "@/lib/open-status";
import {
  SELECTABLE_DAYS,
  madridDateString,
  mondayIndexedWeekday,
  sundayIndexedWeekday,
  recentMadridDates,
  resolveSelectedDate,
} from "@/lib/today-vs-typical";
import {
  TODAY_LABEL,
  lastWeekdaysLabel,
  dateLineLabel,
  lastUpdatedLabel,
} from "@/lib/labels";
import {
  latestReadingTimestamp,
  formatMadridTime,
  isLastUpdatedStale,
  STALE_AFTER_MINUTES,
} from "@/lib/last-updated";
import { DaySelector } from "@/components/DaySelector";
import { shortVenueName, venueSlug, findVenueBySlug } from "@/lib/venues";
import { occupancyScaleGradientCss } from "@/lib/occupancy-color";
import type { Venue } from "@/lib/queries";
import {
  type SearchParams,
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
    const legacyId = parseLegacyVenueId(sp.venue);
    if (legacyId !== null) {
      const venues = await getCachedVenues();
      const legacyVenue = venues.find((v) => v.id === legacyId);
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

  const todayStr = madridDateString(now);
  // Day-stable key for the picker's available-days set (changes once a day).
  const dayKeyIso = `${todayStr}T12:00:00.000Z`;

  const [liveReadings, todayVisitorCounts, venueHours, availableDates] = await Promise.all([
    getCachedLiveReadings(),
    getCachedTodayVisitorCounts(roundedNowIso),
    getCachedVenueHours(),
    // Only the picker needs this, and only when a venue is selected.
    selectedVenue
      ? getCachedDatesWithData(selectedVenue.id, dayKeyIso)
      : Promise.resolve<string[]>([]),
  ]);

  // The line chart's selected day: today (live) by default, or a validated
  // recent date from `?date=`. A stale/malformed value — or a past day with no
  // data — falls back to today.
  const selectedDate =
    resolveSelectedDate(sp.date, now, SELECTABLE_DAYS, availableDates) ?? todayStr;
  const isToday = selectedDate === todayStr;
  const anchorDate = isToday ? null : selectedDate;
  // A past day's data is static, so feed the chart a day-stable "now" — its
  // per-minute cache entry would otherwise churn on every auto-refresh for
  // nothing. Today keeps the live, per-minute nowIso.
  const chartNowIso = isToday ? roundedNowIso : dayKeyIso;

  // Current Madrid moment, so the live cards can show "Cerrado" for venues that
  // are closed right now (their newest reading is from closing time).
  const nowMoment = madridMoment(now);

  // Freshest reading across venues = the last successful scrape cycle. Surfaced
  // as a single "Actualizado a las HH:MM" stamp; re-renders with the 60s refresh.
  const lastUpdated = latestReadingTimestamp(liveReadings);
  // Flag the stamp as stale only when data is *expected* to be flowing — i.e.
  // some venue was open within the staleness window. The look-back grace mirrors
  // the collector's monitor: it avoids false alarms overnight and just after
  // opening (before the first reading of the day lands).
  const graceMoment = madridMoment(
    new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000)
  );
  const expectFresh = anyVenueOpenAt(
    venueHours,
    liveReadings.map((r) => r.venueId),
    graceMoment
  );
  const lastUpdatedStale = isLastUpdatedStale(lastUpdated, now, expectFresh);

  // Per-venue chart inputs (only consumed when a venue is selected).
  const selectedVenueName = selectedVenue ? shortVenueName(selectedVenue.name) : "";
  // Baseline legend label for the plotted day's weekday, e.g. "Últimos sábados".
  const typicalLabel = lastWeekdaysLabel(mondayIndexedWeekday(selectedDate));
  // Primary-line label + card-title fragment: "Hoy" today, else "Sáb 20 jun".
  const dayLabel = isToday ? TODAY_LABEL : dateLineLabel(selectedDate);
  // Crop the line chart to the venue's open hours for the *plotted* day's weekday.
  const openWindow = selectedVenue
    ? openWindowFor(venueHours, selectedVenue.id, sundayIndexedWeekday(selectedDate))
    : null;
  // Earliest day the chart's date picker allows (today is the latest); the
  // recent-date list is most-recent-first, so its tail is the oldest.
  const recentDates = recentMadridDates(now, SELECTABLE_DAYS);
  const minSelectableDate = recentDates[recentDates.length - 1] ?? todayStr;

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <AutoRefresh intervalMs={60_000} />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            className="font-heading text-2xl bg-clip-text text-transparent w-fit"
            style={{ backgroundImage: occupancyScaleGradientCss() }}
          >
            <span className="font-black">Sputnik</span>
            <span className="font-normal">Climbing</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Aforo en tiempo real - todos los rocódromos
          </h2>
          {lastUpdated && (
            <p
              className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${
                lastUpdatedStale
                  ? "font-medium text-amber-600 dark:text-amber-500"
                  : "text-muted-foreground"
              }`}
            >
              {lastUpdatedStale && (
                <AlertTriangle aria-hidden className="size-3.5" />
              )}
              {lastUpdatedLabel(formatMadridTime(lastUpdated))}
            </p>
          )}
        </div>
        <Suspense>
          <LiveCards
            readings={liveReadings}
            todayCounts={todayVisitorCounts}
            venueHours={venueHours}
            nowMoment={nowMoment}
            selectedId={selectedVenue?.id}
          />
        </Suspense>
      </section>

      <Card>
        <CardHeader>
          <div className="flex min-h-7 items-center justify-between gap-3">
            <CardTitle className="font-heading text-base">
              {dayLabel} vs. media{selectedVenueName && ` — ${selectedVenueName}`}
            </CardTitle>
            {selectedVenue && (
              <DaySelector
                selected={selectedDate}
                today={todayStr}
                minDate={minSelectableDate}
                availableDates={availableDates}
                triggerLabel={dayLabel}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {selectedVenue ? (
            // Key on the selected day so changing it remounts the boundary and
            // shows the skeleton while the new day loads, instead of lingering
            // on the previous day's chart (which reads as a glitch mid-fetch).
            <Suspense key={selectedDate} fallback={<ChartSkeleton className="h-64" />}>
              <TodayVsTypicalSection
                venueId={selectedVenue.id}
                nowIso={chartNowIso}
                openMin={openWindow?.openMin ?? null}
                closeMin={openWindow?.closeMin ?? null}
                anchorDate={anchorDate}
                dayLabel={dayLabel}
                typicalLabel={typicalLabel}
              />
            </Suspense>
          ) : (
            <ChartPlaceholder
              className="h-64"
              icon={<LineChart className="h-6 w-6" />}
              label="Selecciona un rocódromo para comparar hoy con su media"
            >
              <TodayVsTypicalChart
                data={[]}
                dayLabel={TODAY_LABEL}
                typicalLabel="media"
                isToday={false}
              />
            </ChartPlaceholder>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-8 xl:grid-cols-2 items-start">
        <Card>
          <CardHeader>
            {/* min-h-7 keeps this title aligned with the footfall card beside it. */}
            <div className="flex min-h-7 items-center">
              <CardTitle className="font-heading text-base">
                Mapa de calor{selectedVenueName && ` — ${selectedVenueName}`}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {selectedVenue ? (
              <Suspense fallback={<ChartSkeleton className="h-64" />}>
                <HeatmapSection venueId={selectedVenue.id} />
              </Suspense>
            ) : (
              <ChartPlaceholder
                className="h-64"
                icon={<CalendarDays className="h-6 w-6" />}
                label="Selecciona un rocódromo para ver su mapa de calor"
              >
                <HeatmapChart data={[]} venueId={-1} hours={[]} />
              </ChartPlaceholder>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex min-h-7 items-center">
              <CardTitle className="font-heading text-base">
                Actividad por día de la semana{selectedVenueName && ` — ${selectedVenueName}`}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {selectedVenue ? (
              <Suspense fallback={<ChartSkeleton className="h-64" />}>
                <WeekdayFootfallSection venueId={selectedVenue.id} dayIso={dayKeyIso} />
              </Suspense>
            ) : (
              <ChartPlaceholder
                className="h-64"
                icon={<BarChart3 className="h-6 w-6" />}
                label="Selecciona un rocódromo para ver su día más y menos concurrido"
              >
                <WeekdayFootfallChart data={[]} />
              </ChartPlaceholder>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
