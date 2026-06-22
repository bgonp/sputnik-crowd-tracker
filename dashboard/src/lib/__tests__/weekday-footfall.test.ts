import { describe, it, expect } from "vitest";
import {
  buildWeekdayFootfallSeries,
  weekdayActivityScale,
  overallDailyAverage,
} from "../weekday-footfall";
import type { WeekdayFootfall } from "../queries";

/** A WeekdayFootfall row; sampleDays defaults to 8 (irrelevant to most tests). */
const wf = (day: number, avgVisitors: number, sampleDays = 8): WeekdayFootfall => ({
  day,
  avgVisitors,
  sampleDays,
});

describe("buildWeekdayFootfallSeries", () => {
  it("expands sparse data into a fixed Monday→Sunday series of seven days", () => {
    const series = buildWeekdayFootfallSeries([wf(0, 120), wf(5, 300)]);
    expect(series.map((d) => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(series[0]).toMatchObject({ label: "Lun", fullLabel: "lunes", avgVisitors: 120, hasData: true });
    expect(series[5]).toMatchObject({ label: "Sáb", fullLabel: "sábado", avgVisitors: 300, hasData: true });
  });

  it("marks weekdays with no readings as hasData:false at 0 visitors", () => {
    const series = buildWeekdayFootfallSeries([wf(0, 120)]);
    expect(series[1]).toMatchObject({ avgVisitors: 0, hasData: false }); // Tue, no data
    expect(series.filter((d) => d.hasData)).toHaveLength(1);
  });
});

describe("weekdayActivityScale", () => {
  it("places the quietest day at 0 and the busiest at 1, the rest in between", () => {
    const series = buildWeekdayFootfallSeries([wf(0, 100), wf(1, 300), wf(2, 200)]);
    const scale = weekdayActivityScale(series);
    expect(scale[0]).toBe(0);
    expect(scale[1]).toBe(1);
    expect(scale[2]).toBe(0.5);
    // Days with no data are null (rendered neutral, not green).
    expect(scale[3]).toBeNull();
  });

  it("returns all null when every day ties (no meaningful ranking)", () => {
    expect(weekdayActivityScale(buildWeekdayFootfallSeries([wf(0, 150), wf(1, 150)]))).toEqual(
      Array(7).fill(null)
    );
  });

  it("returns all null when there is no data at all", () => {
    expect(weekdayActivityScale(buildWeekdayFootfallSeries([]))).toEqual(Array(7).fill(null));
  });
});

describe("overallDailyAverage", () => {
  it("count-weights the weekday means (true average of all days, not of the means)", () => {
    // 8 days @ 100 and 2 days @ 300 → (800 + 600) / 10 = 140, not (100+300)/2 = 200.
    expect(overallDailyAverage([wf(0, 100, 8), wf(1, 300, 2)])).toBe(140);
  });

  it("rounds to a whole number of visitors", () => {
    // (100·1 + 101·2) / 3 = 100.67 → 101.
    expect(overallDailyAverage([wf(0, 100, 1), wf(1, 101, 2)])).toBe(101);
  });

  it("returns null when there is no data", () => {
    expect(overallDailyAverage([])).toBeNull();
  });
});
