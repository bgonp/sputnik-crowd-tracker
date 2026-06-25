import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { WeekdayFootfall } from "@/lib/queries";

const { getCachedWeekdayFootfall } = vi.hoisted(() => ({
  getCachedWeekdayFootfall: vi.fn(),
}));
vi.mock("@/lib/cached-queries", () => ({ getCachedWeekdayFootfall }));

// Stub the chart so we can assert the section forwards data without rendering
// the (brittle) Recharts internals.
const { chartSpy } = vi.hoisted(() => ({ chartSpy: vi.fn() }));
vi.mock("@/components/WeekdayFootfallChart", () => ({
  WeekdayFootfallChart: (props: { data: WeekdayFootfall[]; todayWeekday: number }) => {
    chartSpy(props);
    return <div data-testid="weekday-footfall-chart" />;
  },
}));

import { WeekdayFootfallSection } from "../WeekdayFootfallSection";

const DATA: WeekdayFootfall[] = [
  { day: 0, avgVisitors: 120, sampleDays: 8 },
  { day: 5, avgVisitors: 300, sampleDays: 8 },
];

beforeEach(() => {
  getCachedWeekdayFootfall.mockReset().mockResolvedValue(DATA);
  chartSpy.mockReset();
});

describe("WeekdayFootfallSection", () => {
  it("fetches with the day-stable cache key and forwards data to the chart", async () => {
    const element = await WeekdayFootfallSection({
      venueId: 7,
      dayIso: "2026-06-22T12:00:00.000Z",
      todayWeekday: 6,
    });
    render(element);

    expect(getCachedWeekdayFootfall).toHaveBeenCalledWith(7, "2026-06-22T12:00:00.000Z");
    expect(chartSpy).toHaveBeenCalledWith({ data: DATA, todayWeekday: 6 });
  });
});
