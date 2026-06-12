import { getHourlyAverages } from "@/lib/queries";
import { HourlyChart } from "@/components/HourlyChart";
import type { Unit } from "@/components/UnitToggle";
import type { LiveReading } from "@/lib/queries";

interface Props {
  venueId: number;
  unit: Unit;
  currentHour: number;
  currentReading?: LiveReading;
}

export async function HourlySection({ venueId, unit, currentHour, currentReading }: Props) {
  const data = await getHourlyAverages([venueId]);
  return (
    <HourlyChart
      data={data}
      unit={unit}
      currentHour={currentHour}
      currentPct={currentReading?.percentage}
      currentOccupancy={currentReading?.occupancy}
    />
  );
}
