import { getCachedDailyAverages } from "@/lib/cached-queries";
import { DailyChart } from "@/components/DailyChart";
import type { Unit } from "@/components/UnitToggle";

export async function DailySection({ venueId, unit }: { venueId: number; unit: Unit }) {
  const data = await getCachedDailyAverages([venueId]);
  return <DailyChart data={data} unit={unit} />;
}
