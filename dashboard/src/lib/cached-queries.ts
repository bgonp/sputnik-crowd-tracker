import { unstable_cache } from "next/cache";
import {
  getVenues,
  getVenueHours,
  getLiveReadings,
  getTodayVisitorCounts,
  getHeatmap,
  getTodayVsTypical,
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

// Carries today's live line, so it tracks the 60s refresh cadence. The nowIso
// (rounded to the minute by the caller) and the open window are part of the
// cache key. openMin/closeMin are null when the venue has no configured hours.
export const getCachedTodayVsTypical = unstable_cache(
  (venueId: number, nowIso: string, openMin: number | null, closeMin: number | null) =>
    getTodayVsTypical(
      venueId,
      new Date(nowIso),
      undefined,
      openMin !== null && closeMin !== null ? { openMin, closeMin } : null
    ),
  ["today-vs-typical"],
  { revalidate: 60 }
);
