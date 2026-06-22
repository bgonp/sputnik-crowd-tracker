import { describe, it, expect } from "vitest";
import { latestReadingTimestamp, formatMadridTime } from "../last-updated";

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
