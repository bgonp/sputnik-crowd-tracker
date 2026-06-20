import { unstable_cache } from "next/cache";
import {
  getVenues,
  getVenueHours,
  getLiveReadings,
  getTodayVisitorCounts,
  getHeatmap,
  getHourlyAverages,
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

export const getCachedHourlyAverages = unstable_cache(
  getHourlyAverages,
  ["hourly-averages"],
  { revalidate: 300 }
);

// Carries today's live line, so it tracks the 60s refresh cadence. The nowIso
// (rounded to the minute by the caller) is part of the cache key.
export const getCachedTodayVsTypical = unstable_cache(
  (venueId: number, nowIso: string) => getTodayVsTypical(venueId, new Date(nowIso)),
  ["today-vs-typical"],
  { revalidate: 60 }
);
