import { describe, it, expect } from "vitest";
import type { TodayVsTypicalPoint } from "../queries";
import {
  madridDateString,
  sameWeekdayDates,
  madridWeekdayMondayIndexed,
  formatMinuteOfDay,
  buildTodayVsTypicalSeries,
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

  it("selects percentage values by default", () => {
    expect(buildTodayVsTypicalSeries(points, "percentage")).toEqual([
      { time: "10:00", today: 50, typical: 38 },
      { time: "10:15", today: null, typical: 40 },
    ]);
  });

  it("selects absolute (people) values when requested", () => {
    expect(buildTodayVsTypicalSeries(points, "absolute")).toEqual([
      { time: "10:00", today: 40, typical: 30 },
      { time: "10:15", today: null, typical: 32 },
    ]);
  });

  it("preserves nulls so the live line can break at 'now'", () => {
    const [, second] = buildTodayVsTypicalSeries(points, "percentage");
    expect(second.today).toBeNull();
    expect(second.typical).toBe(40);
  });
});
