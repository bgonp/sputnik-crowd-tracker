import { describe, it, expect } from "vitest";
import {
  latestReadingTimestamp,
  formatMadridTime,
  isLastUpdatedStale,
  STALE_AFTER_MINUTES,
} from "../last-updated";

describe("latestReadingTimestamp", () => {
  it("returns null for no readings", () => {
    expect(latestReadingTimestamp([])).toBeNull();
  });

  it("returns the single timestamp when there is one reading", () => {
    expect(latestReadingTimestamp([{ timestamp: "2026-06-22T17:42:00.000Z" }])).toBe(
      "2026-06-22T17:42:00.000Z"
    );
  });

  it("returns the freshest (max) timestamp across venues", () => {
    const readings = [
      { timestamp: "2026-06-22T17:42:00.000Z" }, // open venue, fresh
      { timestamp: "2026-06-21T21:00:00.000Z" }, // closed venue, stale closing-time reading
      { timestamp: "2026-06-22T17:41:00.000Z" },
    ];
    expect(latestReadingTimestamp(readings)).toBe("2026-06-22T17:42:00.000Z");
  });
});

describe("formatMadridTime", () => {
  it("converts a UTC timestamp to Madrid summer time (CEST, +2)", () => {
    // 17:42 UTC → 19:42 in Madrid during DST.
    expect(formatMadridTime("2026-06-22T17:42:00.000Z")).toBe("19:42");
  });

  it("converts a UTC timestamp to Madrid winter time (CET, +1)", () => {
    // 17:42 UTC → 18:42 in Madrid outside DST.
    expect(formatMadridTime("2026-01-15T17:42:00.000Z")).toBe("18:42");
  });

  it("pads single-digit hours and minutes", () => {
    // 07:05 UTC → 09:05 Madrid (DST).
    expect(formatMadridTime("2026-06-22T07:05:00.000Z")).toBe("09:05");
  });
});

describe("isLastUpdatedStale", () => {
  const now = new Date("2026-06-22T17:42:00.000Z");

  it("is not stale when the reading is within the threshold", () => {
    const recent = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(isLastUpdatedStale(recent, now, true)).toBe(false);
  });

  it("is stale when fresh data is expected but the reading aged past the threshold", () => {
    const old = new Date(now.getTime() - 25 * 60_000).toISOString();
    expect(isLastUpdatedStale(old, now, true)).toBe(true);
  });

  it("is never stale when fresh data is not expected (e.g. all venues closed)", () => {
    const old = new Date(now.getTime() - 6 * 60 * 60_000).toISOString();
    expect(isLastUpdatedStale(old, now, false)).toBe(false);
  });

  it("treats exactly the threshold as still fresh (strictly greater is stale)", () => {
    const atThreshold = new Date(
      now.getTime() - STALE_AFTER_MINUTES * 60_000
    ).toISOString();
    expect(isLastUpdatedStale(atThreshold, now, true)).toBe(false);
    const justOver = new Date(
      now.getTime() - (STALE_AFTER_MINUTES * 60_000 + 1_000)
    ).toISOString();
    expect(isLastUpdatedStale(justOver, now, true)).toBe(true);
  });

  it("is not stale when there is no reading", () => {
    expect(isLastUpdatedStale(null, now, true)).toBe(false);
  });

  it("honours a custom threshold", () => {
    const old = new Date(now.getTime() - 10 * 60_000).toISOString();
    expect(isLastUpdatedStale(old, now, true, 5)).toBe(true);
    expect(isLastUpdatedStale(old, now, true, 20)).toBe(false);
  });
});
