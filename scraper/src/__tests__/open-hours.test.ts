import { describe, it, expect } from "vitest";
import {
  normalizeVenueName,
  madridMoment,
  isVenueOpenAt,
  anyVenueOpenAt,
  windowForVenue,
  type MadridMoment,
} from "../open-hours.js";

// Build a Madrid moment without going through a Date.
const at = (dow: number, hour: number, minute = 0): MadridMoment => ({
  dow,
  minuteOfDay: hour * 60 + minute,
});

describe("normalizeVenueName", () => {
  it("drops the ' Principal' suffix, accents, and case", () => {
    expect(normalizeVenueName("Chamberí Principal")).toBe("chamberi");
    expect(normalizeVenueName("Las Rozas Principal")).toBe("las rozas");
    expect(normalizeVenueName("Alcobendas")).toBe("alcobendas");
  });
});

describe("madridMoment", () => {
  it("applies the +2 summer (DST) offset", () => {
    // 2026-06-19 is a Friday (dow 5); +2h → 07:30 Madrid.
    expect(madridMoment(new Date("2026-06-19T05:30:00Z"))).toEqual({ dow: 5, minuteOfDay: 7 * 60 + 30 });
  });

  it("applies the +1 winter (standard) offset", () => {
    // 2026-01-15 is a Thursday (dow 4); +1h → 23:30 Madrid.
    expect(madridMoment(new Date("2026-01-15T22:30:00Z"))).toEqual({ dow: 4, minuteOfDay: 23 * 60 + 30 });
  });

  it("derives the correct day-of-week (Sunday = 0)", () => {
    // 2026-01-18 is a Sunday; +1h → 09:30 Madrid.
    expect(madridMoment(new Date("2026-01-18T08:30:00Z"))).toEqual({ dow: 0, minuteOfDay: 9 * 60 + 30 });
  });
});

describe("isVenueOpenAt", () => {
  it("is open during weekday hours and closed outside them", () => {
    expect(isVenueOpenAt("Alcobendas Principal", at(1, 7, 0))).toBe(true); // opens 07:00
    expect(isVenueOpenAt("Alcobendas Principal", at(1, 6, 59))).toBe(false);
    expect(isVenueOpenAt("Alcobendas Principal", at(1, 23, 0))).toBe(false); // close is exclusive
  });

  it("honors per-venue weekend differences", () => {
    // Saturday: Alcobendas closes 21:00, Las Rozas closes 22:00.
    expect(isVenueOpenAt("Alcobendas Principal", at(6, 21, 30))).toBe(false);
    expect(isVenueOpenAt("Las Rozas Principal", at(6, 21, 30))).toBe(true);
    // Sunday: Las Rozas opens 08:00, Alcobendas opens 09:00.
    expect(isVenueOpenAt("Las Rozas Principal", at(0, 8, 0))).toBe(true);
    expect(isVenueOpenAt("Alcobendas Principal", at(0, 8, 0))).toBe(false);
  });

  it("uses Berango's later weekday opening", () => {
    expect(isVenueOpenAt("Berango Principal", at(1, 9, 0))).toBe(false); // opens 10:00
    expect(isVenueOpenAt("Berango Principal", at(1, 10, 0))).toBe(true);
  });

  it("treats an unknown venue as always open (fail-safe)", () => {
    expect(isVenueOpenAt("Mystery Wall", at(1, 3, 0))).toBe(true);
  });
});

describe("anyVenueOpenAt", () => {
  it("is false overnight when every venue is closed", () => {
    expect(anyVenueOpenAt(at(1, 3, 0))).toBe(false);
    expect(anyVenueOpenAt(at(1, 6, 30))).toBe(false); // before the 07:00 Madrid openings
  });

  it("is true once the earliest venue opens and until the last closes", () => {
    expect(anyVenueOpenAt(at(1, 7, 0))).toBe(true); // Madrid venues open
    expect(anyVenueOpenAt(at(1, 22, 30))).toBe(true); // weekday close is 23:00
    expect(anyVenueOpenAt(at(1, 23, 0))).toBe(false); // all closed at 23:00
  });

  it("is false on a Sunday after the 21:00 closings", () => {
    expect(anyVenueOpenAt(at(0, 21, 30))).toBe(false);
  });
});

describe("windowForVenue", () => {
  it("returns the per-day window for a known venue", () => {
    expect(windowForVenue("Berango Principal", 1)).toEqual({ openMin: 10 * 60, closeMin: 22 * 60 });
  });

  it("returns undefined for an unknown venue", () => {
    expect(windowForVenue("Mystery Wall", 1)).toBeUndefined();
  });
});
