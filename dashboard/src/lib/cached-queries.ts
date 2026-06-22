import { unstable_cache } from "next/cache";
import {
  getVenues,
  getVenueHours,
  getLiveReadings,
  getTodayVisitorCounts,
  getWeekdayFootfall,
  getHeatmap,
  getTodayVsTypical,
  getDatesWithData,
} from "./queries";

export const getCachedVenues = unstable_cache(getVenues, ["venues"], {
  revalidate: 3600,
});

// Opening hours change rarely — cache for an hour like the venue list.
export const getCachedVenueHours = unstable_cache(getVenueHours, ["venue-hours"], {
  revalidate: 3600,
});

export const getCachedLiveReadings = unstable_cache(
  getLiveReadings,
  ["live-readings"],
  { revalidate: 60 }
);

export const getCachedTodayVisitorCounts = unstable_cache(
  (nowIso: string) => getTodayVisitorCounts(new Date(nowIso)),
  ["today-visitor-counts"],
  { revalidate: 60 }
);

export const getCachedHeatmap = unstable_cache(getHeatmap, ["heatmap"], {
  revalidate: 300,
});

// Per-weekday averages over an 8-week window — the set shifts at most once a
// day, so the caller keys on a day-stable ISO (`<today>T12:00:00Z`) and we
// revalidate on the aggregate cadence to keep Turso reads low.
export const getCachedWeekdayFootfall = unstable_cache(
  (venueId: number, dayIso: string) => getWeekdayFootfall(venueId, new Date(dayIso)),
  ["weekday-footfall"],
  { revalidate: 300 }
);

// The picker's selectable days change at most once a day, so the caller keys on
// a day-stable ISO (`<today>T12:00:00Z`) and we cache for an hour like venues.
export const getCachedDatesWithData = unstable_cache(
  (venueId: number, dayIso: string) => getDatesWithData(venueId, new Date(dayIso)),
  ["dates-with-data"],
  { revalidate: 3600 }
);

// Carries the live line, so it tracks the 60s refresh cadence. The nowIso, the
// open window, and the selected anchorDate are all part of the cache key.
// openMin/closeMin are null when the venue has no configured hours; anchorDate
// is null for today (the default) and a `YYYY-MM-DD` string for a past day —
// the caller then passes a day-stable nowIso so a static past day caches once.
export const getCachedTodayVsTypical = unstable_cache(
  (
    venueId: number,
    nowIso: string,
    openMin: number | null,
    closeMin: number | null,
    anchorDate: string | null
  ) =>
    getTodayVsTypical(
      venueId,
      new Date(nowIso),
      undefined,
      openMin !== null && closeMin !== null ? { openMin, closeMin } : null,
      anchorDate ?? undefined
    ),
  ["today-vs-typical"],
  { revalidate: 60 }
);
