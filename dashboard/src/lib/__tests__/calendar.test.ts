import { describe, it, expect } from "vitest";
import { buildCalendarMonth, monthOf, shiftMonth } from "../calendar";

const args = {
  year: 2026,
  month: 5, // June
  selected: "2026-06-20",
  today: "2026-06-20",
  min: "2026-05-22",
  max: "2026-06-20",
};

describe("buildCalendarMonth", () => {
  it("labels the month in Spanish and lays out 6 Monday-first weeks", () => {
    const m = buildCalendarMonth(args);
    expect(m.label).toBe("junio 2026");
    expect(m.weeks).toHaveLength(6);
    expect(m.weeks.every((w) => w.length === 7)).toBe(true);
    // June 1 2026 is a Monday, so it leads the first row.
    expect(m.weeks[0][0]).toMatchObject({ date: "2026-06-01", day: 1, inMonth: true });
  });

  it("flags today and the selected day", () => {
    const m = buildCalendarMonth({ ...args, selected: "2026-06-18" });
    const cells = m.weeks.flat();
    expect(cells.find((c) => c.date === "2026-06-20")).toMatchObject({ isToday: true });
    expect(cells.find((c) => c.date === "2026-06-18")).toMatchObject({ isSelected: true });
  });

  it("disables days outside [min, max] and marks out-of-month days", () => {
    // A window fully inside June, so both edges sit in the visible June grid
    // (June 1 2026 is a Monday, so the view shows no leading May days).
    const cells = buildCalendarMonth({
      year: 2026,
      month: 5,
      selected: "2026-06-15",
      today: "2026-06-20",
      min: "2026-06-05",
      max: "2026-06-20",
    }).weeks.flat();
    const byDate = (d: string) => cells.find((c) => c.date === d)!;
    expect(byDate("2026-06-21").disabled).toBe(true); // after max
    expect(byDate("2026-06-04").disabled).toBe(true); // before min
    expect(byDate("2026-06-05").disabled).toBe(false); // exactly min
    expect(byDate("2026-06-20").disabled).toBe(false); // exactly max
    expect(byDate("2026-07-01").inMonth).toBe(false); // trailing day from July
    expect(byDate("2026-06-10").inMonth).toBe(true);
  });

  it("disables past days without data but never today", () => {
    const cells = buildCalendarMonth({
      year: 2026,
      month: 5,
      selected: "2026-06-20",
      today: "2026-06-20",
      min: "2026-06-05",
      max: "2026-06-20",
      available: new Set(["2026-06-18"]), // note: today (the 20th) is absent
    }).weeks.flat();
    const byDate = (d: string) => cells.find((c) => c.date === d)!;
    expect(byDate("2026-06-18").disabled).toBe(false); // has data
    expect(byDate("2026-06-17").disabled).toBe(true); // in range but no data
    expect(byDate("2026-06-20").disabled).toBe(false); // today, enabled despite absence
  });

  it("reports prev/next availability against the window", () => {
    // June view: May (holds min) is reachable, July (all after max) is not.
    const june = buildCalendarMonth(args);
    expect(june.canGoPrev).toBe(true);
    expect(june.canGoNext).toBe(false);
    // May view: nothing selectable before May, June still has selectable days.
    const may = buildCalendarMonth({ ...args, month: 4 });
    expect(may.canGoPrev).toBe(false);
    expect(may.canGoNext).toBe(true);
  });
});

describe("shiftMonth", () => {
  it("steps within a year", () => {
    expect(shiftMonth(2026, 5, -1)).toEqual({ year: 2026, month: 4 });
    expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
  });

  it("wraps across year boundaries", () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });
});

describe("monthOf", () => {
  it("extracts the year and 0-indexed month from a date string", () => {
    expect(monthOf("2026-06-20")).toEqual({ year: 2026, month: 5 });
    expect(monthOf("2026-01-01")).toEqual({ year: 2026, month: 0 });
  });
});
