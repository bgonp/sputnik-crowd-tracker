import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { HourlyBar, LiveReading } from "@/lib/queries";

const { getCachedHourlyAverages } = vi.hoisted(() => ({
  getCachedHourlyAverages: vi.fn(),
}));
vi.mock("@/lib/cached-queries", () => ({ getCachedHourlyAverages }));

// Stub the chart so we can assert the section forwards the fetched data and the
// live-reading-derived props to it.
const { chartSpy } = vi.hoisted(() => ({ chartSpy: vi.fn() }));
vi.mock("@/components/HourlyChart", () => ({
  HourlyChart: (props: unknown) => {
    chartSpy(props);
    return <div data-testid="hourly-chart" />;
  },
}));

import { HourlySection } from "../HourlySection";

const DATA: HourlyBar[] = [{ hour: 18, avgPercentage: 60, avgOccupancy: 120 }];
const READING: LiveReading = {
  venueId: 7,
  venueName: "Test Principal",
  occupancy: 90,
  capacity: 200,
  percentage: 45,
  timestamp: "2026-06-18T16:00:00Z",
};

beforeEach(() => {
  getCachedHourlyAverages.mockReset().mockResolvedValue(DATA);
  chartSpy.mockReset();
});

describe("HourlySection", () => {
  it("fetches hourly averages for the venue and forwards chart props from the live reading", async () => {
    const element = await HourlySection({
      venueId: 7,
      unit: "percentage",
      currentHour: 18,
      currentReading: READING,
    });
    render(element);

    expect(getCachedHourlyAverages).toHaveBeenCalledWith([7]);
    expect(chartSpy).toHaveBeenCalledWith({
      data: DATA,
      unit: "percentage",
      currentHour: 18,
      currentPct: 45,
      currentOccupancy: 90,
    });
  });

  it("passes undefined current values when there is no live reading", async () => {
    const element = await HourlySection({
      venueId: 7,
      unit: "absolute",
      currentHour: 9,
      currentReading: undefined,
    });
    render(element);

    expect(chartSpy).toHaveBeenCalledWith({
      data: DATA,
      unit: "absolute",
      currentHour: 9,
      currentPct: undefined,
      currentOccupancy: undefined,
    });
  });
});
