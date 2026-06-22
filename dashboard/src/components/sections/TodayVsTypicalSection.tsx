import { getCachedTodayVsTypical } from "@/lib/cached-queries";
import { TodayVsTypicalChart } from "@/components/TodayVsTypicalChart";

interface Props {
  venueId: number;
  nowIso: string;
  // Configured open window for the plotted day's weekday (null when the venue
  // has no hours), used to crop the chart to opening hours.
  openMin: number | null;
  closeMin: number | null;
  // Selected day to plot: null for today (the live default), or a `YYYY-MM-DD`
  // Madrid date for a past day.
  anchorDate: string | null;
  dayLabel: string;
  typicalLabel: string;
}

export async function TodayVsTypicalSection({
  venueId,
  nowIso,
  openMin,
  closeMin,
  anchorDate,
  dayLabel,
  typicalLabel,
}: Props) {
  const data = await getCachedTodayVsTypical(venueId, nowIso, openMin, closeMin, anchorDate);
  // anchorDate is null only for today (the live default), where the line's tip
  // marks the current occupancy.
  return (
    <TodayVsTypicalChart
      data={data}
      dayLabel={dayLabel}
      typicalLabel={typicalLabel}
      isToday={anchorDate === null}
    />
  );
}
