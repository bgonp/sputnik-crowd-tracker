import { describe, it, expect } from "vitest";
import {
  buildWeekdayFootfallSeries,
  weekdayActivityScale,
} from "../weekday-footfall";
import type { WeekdayFootfall } from "../queries";

describe("buildWeekdayFootfallSeries", () => {
  it("expands sparse data into a fixed Monday→Sunday series of seven days", () => {
    const data: WeekdayFootfall[] = [
      { day: 0, avgVisitors: 120 }, // Mon
      { day: 5, avgVisitors: 300 }, // Sat
    ];
    const series = buildWeekdayFootfallSeries(data);
    expect(series.map((d) => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(series[0]).toMatchObject({ label: "Lun", fullLabel: "lunes", avgVisitors: 120, hasData: true });
    expect(series[5]).toMatchObject({ label: "Sáb", fullLabel: "sábado", avgVisitors: 300, hasData: true });
  });

  it("marks weekdays with no readings as hasData:false at 0 visitors", () => {
    const series = buildWeekdayFootfallSeries([{ day: 0, avgVisitors: 120 }]);
    expect(series[1]).toMatchObject({ avgVisitors: 0, hasData: false }); // Tue, no data
    expect(series.filter((d) => d.hasData)).toHaveLength(1);
  });
});

describe("weekdayActivityScale", () => {
  it("places the quietest day at 0 and the busiest at 1, the rest in between", () => {
    const series = buildWeekdayFootfallSeries([
      { day: 0, avgVisitors: 100 }, // Mon — min
      { day: 1, avgVisitors: 300 }, // Tue — max
      { day: 2, avgVisitors: 200 }, // Wed — midpoint
    ]);
    const scale = weekdayActivityScale(series);
    expect(scale[0]).toBe(0);
    expect(scale[1]).toBe(1);
    expect(scale[2]).toBe(0.5);
    // Days with no data are null (rendered neutral, not green).
    expect(scale[3]).toBeNull();
  });

  it("returns all null when every day ties (no meaningful ranking)", () => {
    const series = buildWeekdayFootfallSeries([
      { day: 0, avgVisitors: 150 },
      { day: 1, avgVisitors: 150 },
    ]);
    expect(weekdayActivityScale(series)).toEqual(Array(7).fill(null));
  });

  it("returns all null when there is no data at all", () => {
    expect(weekdayActivityScale(buildWeekdayFootfallSeries([]))).toEqual(Array(7).fill(null));
  });
});
