import { describe, it, expect } from "vitest";
import type { TodayVsTypicalPoint } from "../queries";
import {
  madridDateString,
  sameWeekdayDates,
  sameWeekdayDatesFromDateString,
  recentMadridDates,
  resolveSelectedDate,
  mondayIndexedWeekday,
  sundayIndexedWeekday,
  madridWeekdayMondayIndexed,
  formatMinuteOfDay,
  movingAverage,
  buildTodayVsTypicalSeries,
  fillTodayGaps,
  MAX_GAP_FILL_MINUTES,
} from "../today-vs-typical";

describe("madridDateString", () => {
  it("renders the local Madrid date in ISO order", () => {
    // 09:30 UTC on 2026-06-20 is 11:30 in Madrid (summer, +2): same calendar day.
    expect(madridDateString(new Date("2026-06-20T09:30:00Z"))).toBe("2026-06-20");
  });

  it("rolls over to the next day when Madrid is already past midnight", () => {
    // 22:30 UTC is 00:30 the next day in Madrid (+2).
    expect(madridDateString(new Date("2026-06-20T22:30:00Z"))).toBe("2026-06-21");
  });
});

describe("sameWeekdayDates", () => {
  it("returns the previous N same-weekday dates, most recent first", () => {
    // 2026-06-20 is a Saturday.
    const dates = sameWeekdayDates(new Date("2026-06-20T10:00:00Z"), 5);
    expect(dates).toEqual([
      "2026-06-13",
      "2026-06-06",
      "2026-05-30",
      "2026-05-23",
      "2026-05-16",
    ]);
  });

  it("keeps every returned date on the same weekday as today", () => {
    const now = new Date("2026-06-20T10:00:00Z"); // Saturday
    for (const d of sameWeekdayDates(now, 5)) {
      expect(new Date(`${d}T12:00:00Z`).getUTCDay()).toBe(6); // Saturday
    }
  });

  it("crosses month and year boundaries correctly", () => {
    // 2027-01-02 is a Saturday; one week back lands in December 2026.
    const [prev] = sameWeekdayDates(new Date("2027-01-02T10:00:00Z"), 1);
    expect(prev).toBe("2026-12-26");
  });
});

describe("sameWeekdayDatesFromDateString", () => {
  it("steps back N same-weekdays from a date string, most recent first", () => {
    // 2026-06-20 is a Saturday — matches sameWeekdayDates(Date) for the same day.
    expect(sameWeekdayDatesFromDateString("2026-06-20", 5)).toEqual([
      "2026-06-13",
      "2026-06-06",
      "2026-05-30",
      "2026-05-23",
      "2026-05-16",
    ]);
  });

  it("backs sameWeekdayDates, which just anchors on now's Madrid date", () => {
    const now = new Date("2026-06-20T10:00:00Z");
    expect(sameWeekdayDates(now, 3)).toEqual(
      sameWeekdayDatesFromDateString(madridDateString(now), 3)
    );
  });
});

describe("recentMadridDates", () => {
  it("returns the last N Madrid dates ending today, most recent first", () => {
    expect(recentMadridDates(new Date("2026-06-20T10:00:00Z"), 4)).toEqual([
      "2026-06-20",
      "2026-06-19",
      "2026-06-18",
      "2026-06-17",
    ]);
  });

  it("uses the Madrid date, which can be tomorrow late UTC", () => {
    // 22:30 UTC is already the 21st in Madrid (+2).
    expect(recentMadridDates(new Date("2026-06-20T22:30:00Z"), 1)).toEqual(["2026-06-21"]);
  });

  it("crosses month boundaries", () => {
    expect(recentMadridDates(new Date("2026-07-01T10:00:00Z"), 2)).toEqual([
      "2026-07-01",
      "2026-06-30",
    ]);
  });
});

describe("resolveSelectedDate", () => {
  const now = new Date("2026-06-20T10:00:00Z");

  it("accepts a date within the recent window", () => {
    expect(resolveSelectedDate("2026-06-18", now, 30)).toBe("2026-06-18");
  });

  it("returns null for a date outside the window, so the caller uses today", () => {
    expect(resolveSelectedDate("2026-01-01", now, 30)).toBeNull();
  });

  it("rejects future dates (not in the recent list)", () => {
    expect(resolveSelectedDate("2026-06-25", now, 30)).toBeNull();
  });

  it("returns null for missing or malformed values", () => {
    expect(resolveSelectedDate(undefined, now, 30)).toBeNull();
    expect(resolveSelectedDate("not-a-date", now, 30)).toBeNull();
  });

  it("validates the first value when the param is repeated", () => {
    expect(resolveSelectedDate(["2026-06-19", "junk"], now, 30)).toBe("2026-06-19");
  });

  it("rejects a past day with no data when availableDates is given", () => {
    expect(resolveSelectedDate("2026-06-18", now, 30, ["2026-06-17"])).toBeNull();
    expect(resolveSelectedDate("2026-06-18", now, 30, ["2026-06-18"])).toBe("2026-06-18");
  });

  it("always allows today regardless of data availability", () => {
    // today (2026-06-20) is absent from the set but still resolves.
    expect(resolveSelectedDate("2026-06-20", now, 30, ["2026-05-30"])).toBe("2026-06-20");
  });
});

describe("mondayIndexedWeekday", () => {
  it("maps a date string to a Monday-indexed weekday", () => {
    expect(mondayIndexedWeekday("2026-06-20")).toBe(5); // Saturday
    expect(mondayIndexedWeekday("2026-06-21")).toBe(6); // Sunday
    expect(mondayIndexedWeekday("2026-06-22")).toBe(0); // Monday
  });
});

describe("sundayIndexedWeekday", () => {
  it("maps a date string to a Sunday-indexed weekday (venue_hours convention)", () => {
    expect(sundayIndexedWeekday("2026-06-21")).toBe(0); // Sunday
    expect(sundayIndexedWeekday("2026-06-22")).toBe(1); // Monday
    expect(sundayIndexedWeekday("2026-06-20")).toBe(6); // Saturday
  });
});

describe("madridWeekdayMondayIndexed", () => {
  it("maps Saturday to 5", () => {
    expect(madridWeekdayMondayIndexed(new Date("2026-06-20T10:00:00Z"))).toBe(5);
  });

  it("maps Sunday to 6", () => {
    expect(madridWeekdayMondayIndexed(new Date("2026-06-21T10:00:00Z"))).toBe(6);
  });

  it("maps Monday to 0", () => {
    expect(madridWeekdayMondayIndexed(new Date("2026-06-22T10:00:00Z"))).toBe(0);
  });
});

describe("formatMinuteOfDay", () => {
  it("zero-pads hours and minutes", () => {
    expect(formatMinuteOfDay(0)).toBe("00:00");
    expect(formatMinuteOfDay(615)).toBe("10:15");
    expect(formatMinuteOfDay(1395)).toBe("23:15");
  });
});

describe("buildTodayVsTypicalSeries", () => {
  const points: TodayVsTypicalPoint[] = [
    {
      minuteOfDay: 600,
      todayOccupancy: 40,
      todayPercentage: 50,
      typicalOccupancy: 30,
      typicalPercentage: 38,
    },
    {
      minuteOfDay: 615,
      todayOccupancy: null, // today hasn't reached this slot
      todayPercentage: null,
      typicalOccupancy: 32,
      typicalPercentage: 40,
    },
  ];

  it("carries both percentage and people, leaving today raw and smoothing the baseline", () => {
    // Two points, so the moving average over the baseline collapses both to the
    // mean (38,40 → 39 and 30,32 → 31); today passes through untouched.
    expect(buildTodayVsTypicalSeries(points)).toEqual([
      { time: "10:00", todayPct: 50, todayAbs: 40, typicalPct: 39, typicalAbs: 31 },
      { time: "10:15", todayPct: null, todayAbs: null, typicalPct: 39, typicalAbs: 31 },
    ]);
  });

  it("pulls a baseline spike toward its neighbours while today keeps the spike", () => {
    const spike: TodayVsTypicalPoint[] = [0, 1, 2, 3, 4].map((i) => ({
      minuteOfDay: 600 + i,
      todayOccupancy: i === 2 ? 99 : 1,
      todayPercentage: i === 2 ? 99 : 1,
      typicalOccupancy: i === 2 ? 99 : 1,
      typicalPercentage: i === 2 ? 99 : 1,
    }));
    const [, , mid] = buildTodayVsTypicalSeries(spike);
    expect(mid.todayPct).toBe(99); // today's actual reading is left raw
    expect(mid.typicalPct).toBeLessThan(99); // baseline spike is averaged down
    expect(mid.typicalPct).toBeGreaterThan(1);
  });

  it("preserves today nulls so the live line can break at 'now'", () => {
    const [, second] = buildTodayVsTypicalSeries(points);
    expect(second.todayPct).toBeNull();
    expect(second.todayAbs).toBeNull();
    expect(typeof second.typicalPct).toBe("number"); // baseline stays present (smoothed)
  });
});

describe("movingAverage", () => {
  it("averages each point with its neighbours within the radius", () => {
    expect(movingAverage([2, 4, 6], 1)).toEqual([3, 4, 5]);
  });

  it("skips nulls, and yields null only when the whole window is empty", () => {
    expect(movingAverage([null, 4, 6], 1)).toEqual([4, 5, 5]);
    expect(movingAverage([null, null], 1)).toEqual([null, null]);
  });
});

describe("fillTodayGaps", () => {
  // Build a point with today occ/pct (null for a hole) and a constant baseline.
  const pt = (
    minuteOfDay: number,
    occ: number | null,
    pct: number | null
  ): TodayVsTypicalPoint => ({
    minuteOfDay,
    todayOccupancy: occ,
    todayPercentage: pct,
    typicalOccupancy: 20,
    typicalPercentage: 25,
  });

  it("bridges a short interior gap by linear interpolation (both % and people)", () => {
    const filled = fillTodayGaps([
      pt(600, 40, 50),
      pt(601, null, null),
      pt(602, 50, 70),
    ]);
    // f = 0.5 at minute 601 → occ (40→50)=45, pct (50→70)=60.
    expect(filled[1]).toMatchObject({ todayOccupancy: 45, todayPercentage: 60 });
  });

  it("interpolates each null in a multi-minute hole by its distance", () => {
    const filled = fillTodayGaps([
      pt(600, 40, 100),
      pt(601, null, null),
      pt(602, null, null),
      pt(603, null, null),
      pt(604, 40, 140),
    ]);
    // occ is flat (40) so stays 40; pct climbs 100→140 over 4 min: 110/120/130.
    expect(filled.map((p) => p.todayPercentage)).toEqual([100, 110, 120, 130, 140]);
    expect(filled.map((p) => p.todayOccupancy)).toEqual([40, 40, 40, 40, 40]);
  });

  it("leaves trailing nulls (the future) untouched so the live line still stops at now", () => {
    const filled = fillTodayGaps([pt(600, 40, 50), pt(601, null, null), pt(602, null, null)]);
    expect(filled[1]!.todayPercentage).toBeNull();
    expect(filled[2]!.todayPercentage).toBeNull();
  });

  it("leaves leading nulls (before the first reading) untouched", () => {
    const filled = fillTodayGaps([pt(600, null, null), pt(601, 40, 50)]);
    expect(filled[0]!.todayPercentage).toBeNull();
  });

  it("does not bridge a gap longer than the threshold", () => {
    const filled = fillTodayGaps(
      [pt(600, 40, 50), pt(601, null, null), pt(602, 50, 70)],
      // Threshold below the 2-minute span: leave it broken.
      1
    );
    expect(filled[1]!.todayPercentage).toBeNull();
  });

  it("bridges a gap exactly at the threshold span", () => {
    const filled = fillTodayGaps(
      [pt(600, 40, 50), pt(600 + MAX_GAP_FILL_MINUTES - 1, null, null), pt(600 + MAX_GAP_FILL_MINUTES, 40, 50)],
      MAX_GAP_FILL_MINUTES
    );
    expect(filled[1]!.todayPercentage).toBe(50);
  });

  it("does not mutate the input or touch the baseline", () => {
    const input = [pt(600, 40, 50), pt(601, null, null), pt(602, 50, 70)];
    const filled = fillTodayGaps(input);
    expect(input[1]!.todayPercentage).toBeNull(); // original untouched
    expect(filled.every((p) => p.typicalPercentage === 25)).toBe(true); // baseline intact
  });
});

describe("buildTodayVsTypicalSeries — gap bridging", () => {
  const pt = (
    minuteOfDay: number,
    occ: number | null,
    pct: number | null
  ): TodayVsTypicalPoint => ({
    minuteOfDay,
    todayOccupancy: occ,
    todayPercentage: pct,
    typicalOccupancy: 20,
    typicalPercentage: 25,
  });

  it("fills a short interior scrape gap so the series has no break", () => {
    const series = buildTodayVsTypicalSeries([pt(600, 40, 50), pt(601, null, null), pt(602, 50, 70)]);
    expect(series.map((d) => d.todayPct)).toEqual([50, 60, 70]);
  });

  it("still preserves trailing nulls so the live line breaks at 'now'", () => {
    const series = buildTodayVsTypicalSeries([pt(600, 40, 50), pt(601, null, null)]);
    expect(series[1]!.todayPct).toBeNull();
  });
});
