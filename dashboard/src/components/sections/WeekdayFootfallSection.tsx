import { getCachedWeekdayFootfall } from "@/lib/cached-queries";
import { WeekdayFootfallChart } from "@/components/WeekdayFootfallChart";

interface Props {
  venueId: number;
  // Day-stable ISO (`<today>T12:00:00Z`) — the cache key for the rolling window.
  dayIso: string;
}

export async function WeekdayFootfallSection({ venueId, dayIso }: Props) {
  const data = await getCachedWeekdayFootfall(venueId, dayIso);
  return <WeekdayFootfallChart data={data} />;
}
