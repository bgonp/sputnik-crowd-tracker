import { describe, it, expect } from "vitest";
import type { VenueHours } from "../queries";
import {
  madridMoment,
  formatMinute,
  openStatusFor,
  openWindowFor,
  type MadridMoment,
} from "../open-status";

// Venue 1 schedule: weekday 07:00–23:00, Saturday 09:00–22:00, Sunday 09:00–21:00.
const hours: VenueHours[] = [
  { venueId: 1, dow: 0, openMin: 9 * 60, closeMin: 21 * 60 },
  ...[1, 2, 3, 4, 5].map((dow) => ({ venueId: 1, dow, openMin: 7 * 60, closeMin: 23 * 60 })),
  { venueId: 1, dow: 6, openMin: 9 * 60, closeMin: 22 * 60 },
];

const at = (dow: number, hour: number, minute = 0): MadridMoment => ({ dow, minuteOfDay: hour * 60 + minute });

describe("madridMoment", () => {
  it("applies the +2 summer (DST) offset", () => {
    // 2026-06-19 is a Friday (dow 5); +2h → 07:30 Madrid.
    expect(madridMoment(new Date("2026-06-19T05:30:00Z"))).toEqual({ dow: 5, minuteOfDay: 7 * 60 + 30 });
  });

  it("applies the +1 winter (standard) offset", () => {
    // 2026-01-15 is a Thursday (dow 4); +1h → 23:30 Madrid.
    expect(madridMoment(new Date("2026-01-15T22:30:00Z"))).toEqual({ dow: 4, minuteOfDay: 23 * 60 + 30 });
  });

  it("derives Sunday as dow 0", () => {
    expect(madridMoment(new Date("2026-01-18T08:30:00Z"))).toEqual({ dow: 0, minuteOfDay: 9 * 60 + 30 });
  });
});

describe("formatMinute", () => {
  it("zero-pads hours and minutes", () => {
    expect(formatMinute(7 * 60)).toBe("07:00");
    expect(formatMinute(0)).toBe("00:00");
    expect(formatMinute(23 * 60 + 59)).toBe("23:59");
  });
});

describe("openStatusFor", () => {
  it("is open inside the day's window", () => {
    expect(openStatusFor(hours, 1, at(3, 12))).toEqual({ open: true });
  });

  it("treats the open boundary as open and the close boundary as closed", () => {
    expect(openStatusFor(hours, 1, at(3, 7, 0)).open).toBe(true); // exactly 07:00
    expect(openStatusFor(hours, 1, at(3, 23, 0)).open).toBe(false); // exactly 23:00
  });

  it("reports today's opening when closed earlier in the day", () => {
    expect(openStatusFor(hours, 1, at(3, 2))).toEqual({ open: false, opensAt: "07:00" });
  });

  it("rolls to the next day's opening after closing time", () => {
    // Wednesday 23:30 → Thursday 07:00.
    expect(openStatusFor(hours, 1, at(3, 23, 30))).toEqual({ open: false, opensAt: "07:00" });
    // Friday 23:30 → Saturday 09:00 (weekend opens later).
    expect(openStatusFor(hours, 1, at(5, 23, 30))).toEqual({ open: false, opensAt: "09:00" });
  });

  it("treats a venue with no configured hours as open (fail-safe)", () => {
    expect(openStatusFor(hours, 99, at(1, 3))).toEqual({ open: true });
  });
});

describe("openWindowFor", () => {
  it("returns the open/close minutes for the venue's matching weekday", () => {
    expect(openWindowFor(hours, 1, 0)).toEqual({ openMin: 9 * 60, closeMin: 21 * 60 }); // Sunday
    expect(openWindowFor(hours, 1, 3)).toEqual({ openMin: 7 * 60, closeMin: 23 * 60 }); // Wednesday
    expect(openWindowFor(hours, 1, 6)).toEqual({ openMin: 9 * 60, closeMin: 22 * 60 }); // Saturday
  });

  it("returns null when the venue has no row for that weekday (skip cropping)", () => {
    expect(openWindowFor(hours, 99, 1)).toBeNull();
    expect(openWindowFor([], 1, 1)).toBeNull();
  });
});
