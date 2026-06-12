import { getHeatmap } from "@/lib/queries";
import { HeatmapChart } from "@/components/HeatmapChart";

export async function HeatmapSection({ venueId }: { venueId: number }) {
  const data = await getHeatmap([venueId]);
  return <HeatmapChart data={data} />;
}
