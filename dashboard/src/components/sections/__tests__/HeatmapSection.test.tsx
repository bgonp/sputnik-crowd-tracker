import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { HeatmapCell } from "@/lib/queries";

const { getCachedHeatmap } = vi.hoisted(() => ({ getCachedHeatmap: vi.fn() }));
vi.mock("@/lib/cached-queries", () => ({ getCachedHeatmap }));

// Stub the chart so we can assert the section forwards the fetched data to it
// without rendering the full grid.
const { chartSpy } = vi.hoisted(() => ({ chartSpy: vi.fn() }));
vi.mock("@/components/HeatmapChart", () => ({
  HeatmapChart: (props: { data: HeatmapCell[] }) => {
    chartSpy(props);
    return <div data-testid="heatmap-chart" />;
  },
}));

import { HeatmapSection } from "../HeatmapSection";

const DATA: HeatmapCell[] = [{ day: 0, hour: 18, avgPercentage: 42 }];

beforeEach(() => {
  getCachedHeatmap.mockReset().mockResolvedValue(DATA);
  chartSpy.mockReset();
});

describe("HeatmapSection", () => {
  it("fetches the heatmap for the given venue and passes it to the chart", async () => {
    const element = await HeatmapSection({ venueId: 7 });
    render(element);

    expect(getCachedHeatmap).toHaveBeenCalledWith([7]);
    expect(chartSpy).toHaveBeenCalledWith({ data: DATA });
  });
});
