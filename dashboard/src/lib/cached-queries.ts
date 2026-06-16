import { unstable_cache } from "next/cache";
import {
  getVenues,
  getLiveReadings,
  getTodayVisitorCounts,
  getHeatmap,
  getHourlyAverages,
} from "./queries";

export const getCachedVenues = unstable_cache(getVenues, ["venues"], {
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
