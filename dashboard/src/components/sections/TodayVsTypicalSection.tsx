import { getCachedTodayVsTypical } from "@/lib/cached-queries";
import { TodayVsTypicalChart } from "@/components/TodayVsTypicalChart";

interface Props {
  venueId: number;
  nowIso: string;
  // Configured open window for today's weekday (null when the venue has no
  // hours), used to crop the chart to opening hours.
  openMin: number | null;
  closeMin: number | null;
  todayLabel: string;
  typicalLabel: string;
}

export async function TodayVsTypicalSection({
  venueId,
  nowIso,
  openMin,
  closeMin,
  todayLabel,
  typicalLabel,
}: Props) {
  const data = await getCachedTodayVsTypical(venueId, nowIso, openMin, closeMin);
  return (
    <TodayVsTypicalChart data={data} todayLabel={todayLabel} typicalLabel={typicalLabel} />
  );
}
