import { getTimeSeries } from "@/lib/queries";
import { TimeSeriesChart } from "@/components/TimeSeriesChart";
import type { Unit } from "@/components/UnitToggle";

interface Props {
  venueId: number;
  unit: Unit;
  from: string;
  to: string;
}

export async function TimeSeriesSection({ venueId, unit, from, to }: Props) {
  const data = await getTimeSeries(venueId, from, to);
  return <TimeSeriesChart data={data} unit={unit} />;
}
