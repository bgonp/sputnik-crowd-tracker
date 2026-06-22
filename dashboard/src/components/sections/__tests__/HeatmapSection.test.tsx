import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { HeatmapCell, VenueHours } from "@/lib/queries";

const { getCachedHeatmap, getCachedVenueHours } = vi.hoisted(() => ({
  getCachedHeatmap: vi.fn(),
  getCachedVenueHours: vi.fn(),
}));
vi.mock("@/lib/cached-queries", () => ({ getCachedHeatmap, getCachedVenueHours }));

// Stub the chart so we can assert the section forwards the fetched data to it
// without rendering the full grid.
const { chartSpy } = vi.hoisted(() => ({ chartSpy: vi.fn() }));
vi.mock("@/components/HeatmapChart", () => ({
  HeatmapChart: (props: { data: HeatmapCell[]; venueId: number; hours: VenueHours[] }) => {
    chartSpy(props);
    return <div data-testid="heatmap-chart" />;
  },
}));

import { HeatmapSection } from "../HeatmapSection";

const DATA: HeatmapCell[] = [{ day: 0, hour: 18, avgPercentage: 42 }];
const HOURS: VenueHours[] = [{ venueId: 7, dow: 1, openMin: 7 * 60, closeMin: 23 * 60 }];

beforeEach(() => {
  getCachedHeatmap.mockReset().mockResolvedValue(DATA);
  getCachedVenueHours.mockReset().mockResolvedValue(HOURS);
  chartSpy.mockReset();
});

describe("HeatmapSection", () => {
  it("fetches the heatmap and venue hours and passes them to the chart", async () => {
    const element = await HeatmapSection({ venueId: 7 });
    render(element);

    expect(getCachedHeatmap).toHaveBeenCalledWith([7]);
    expect(getCachedVenueHours).toHaveBeenCalled();
    expect(chartSpy).toHaveBeenCalledWith({ data: DATA, venueId: 7, hours: HOURS });
  });
});
