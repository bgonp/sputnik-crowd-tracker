import { getCachedWeekdayFootfall } from "@/lib/cached-queries";
import { WeekdayFootfallChart } from "@/components/WeekdayFootfallChart";

interface Props {
  venueId: number;
  // Day-stable ISO (`<today>T12:00:00Z`) — the cache key for the rolling window.
  dayIso: string;
  todayWeekday: number;
}

export async function WeekdayFootfallSection({ venueId, dayIso, todayWeekday }: Props) {
  const data = await getCachedWeekdayFootfall(venueId, dayIso);
  return <WeekdayFootfallChart data={data} todayWeekday={todayWeekday} />;
}
