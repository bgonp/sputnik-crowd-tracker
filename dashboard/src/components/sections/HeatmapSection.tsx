import { getCachedHeatmap, getCachedVenueHours } from "@/lib/cached-queries";
import { HeatmapChart } from "@/components/HeatmapChart";

export async function HeatmapSection({
  venueId,
  todayWeekday,
  currentHour,
}: {
  venueId: number;
  todayWeekday: number;
  currentHour: number;
}) {
  const [data, hours] = await Promise.all([
    getCachedHeatmap([venueId]),
    getCachedVenueHours(),
  ]);
  return (
    <HeatmapChart
      data={data}
      venueId={venueId}
      hours={hours}
      todayWeekday={todayWeekday}
      currentHour={currentHour}
    />
  );
}
