import { getCachedHeatmap } from "@/lib/cached-queries";
import { HeatmapChart } from "@/components/HeatmapChart";

export async function HeatmapSection({ venueId }: { venueId: number }) {
  const data = await getCachedHeatmap([venueId]);
  return <HeatmapChart data={data} />;
}
