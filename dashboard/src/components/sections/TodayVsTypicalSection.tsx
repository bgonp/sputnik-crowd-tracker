import { getCachedTodayVsTypical } from "@/lib/cached-queries";
import { TodayVsTypicalChart } from "@/components/TodayVsTypicalChart";
import type { Unit } from "@/components/UnitToggle";

interface Props {
  venueId: number;
  unit: Unit;
  nowIso: string;
  todayLabel: string;
  typicalLabel: string;
}

export async function TodayVsTypicalSection({
  venueId,
  unit,
  nowIso,
  todayLabel,
  typicalLabel,
}: Props) {
  const data = await getCachedTodayVsTypical(venueId, nowIso);
  return (
    <TodayVsTypicalChart
      data={data}
      unit={unit}
      todayLabel={todayLabel}
      typicalLabel={typicalLabel}
    />
  );
}
