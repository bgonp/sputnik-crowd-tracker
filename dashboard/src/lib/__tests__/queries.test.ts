import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResultSet } from "@libsql/client";
import { db } from "../db";
import {
  getDailyAverages,
  getHourlyAverages,
  getHeatmap,
  getTimeSeries,
  getTodayVisitorCounts,
  getTodayVsTypical,
  getLiveReadings,
  getVenues,
  getVenueHours,
  madridOffsetModifier,
} from "../queries";

vi.mock("../db", () => ({
  db: { execute: vi.fn() },
}));

function fakeResult(rows: Record<string, unknown>[]) {
  return { rows } as unknown as ResultSet;
}

beforeEach(() => {
  vi.mocked(db.execute).mockReset();
});

// --- madridOffsetModifier ---

describe("madridOffsetModifier", () => {
  it("returns a string in '+N hours' or '-N hours' format", () => {
    expect(madridOffsetModifier()).toMatch(/^[+-]\d+ hours$/);
  });

  it("returns an offset between -12 and +14 hours", () => {
    const match = madridOffsetModifier().match(/^([+-]\d+) hours$/);
    const offset = parseInt(match![1]);
    expect(offset).toBeGreaterThanOrEqual(-12);
    expect(offset).toBeLessThanOrEqual(14);
  });
});

// --- getDailyAverages ---

describe("getDailyAverages", () => {
  it("returns avgOccupancy alongside avgPercentage", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ dayRaw: 1, avgPercentage: 45, avgOccupancy: 15 }])
    );
    const [result] = await getDailyAverages([1]);
    expect(result).toHaveProperty("avgOccupancy", 15);
    expect(result).toHaveProperty("avgPercentage", 45);
  });

  it("remaps Sunday (dayRaw 0) to day 6", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ dayRaw: 0, avgPercentage: 30, avgOccupancy: 10 }])
    );
    const [result] = await getDailyAverages([1]);
    expect(result.day).toBe(6);
  });

  it("remaps Monday (dayRaw 1) to day 0", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ dayRaw: 1, avgPercentage: 45, avgOccupancy: 15 }])
    );
    const [result] = await getDailyAverages([1]);
    expect(result.day).toBe(0);
  });

  it("remaps Saturday (dayRaw 6) to day 5", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ dayRaw: 6, avgPercentage: 60, avgOccupancy: 20 }])
    );
    const [result] = await getDailyAverages([1]);
    expect(result.day).toBe(5);
  });
});

// --- getHourlyAverages ---

describe("getHourlyAverages", () => {
  it("returns avgOccupancy alongside avgPercentage", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ hour: 9, avgPercentage: 55, avgOccupancy: 22 }])
    );
    const [result] = await getHourlyAverages([1]);
    expect(result).toHaveProperty("avgOccupancy", 22);
    expect(result).toHaveProperty("avgPercentage", 55);
    expect(result).toHaveProperty("hour", 9);
  });

  it("filters out pre-opening hours in SQL", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(fakeResult([]));
    await getHourlyAverages([1]);
    const { sql } = vi.mocked(db.execute).mock.calls[0][0] as unknown as { sql: string };
    expect(sql).toMatch(/HAVING hour >= 7/i);
  });
});

// --- getHeatmap ---

describe("getHeatmap", () => {
  it("remaps Sunday (dayRaw 0) to day 6", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ dayRaw: 0, hour: 10, avgPercentage: 40 }])
    );
    const [result] = await getHeatmap([1]);
    expect(result.day).toBe(6);
  });

  it("remaps Monday (dayRaw 1) to day 0", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ dayRaw: 1, hour: 10, avgPercentage: 40 }])
    );
    const [result] = await getHeatmap([1]);
    expect(result.day).toBe(0);
  });

  it("preserves hour and avgPercentage", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ dayRaw: 3, hour: 14, avgPercentage: 72 }])
    );
    const [result] = await getHeatmap([1]);
    expect(result.hour).toBe(14);
    expect(result.avgPercentage).toBe(72);
  });

  it("filters out pre-opening hours in SQL", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(fakeResult([]));
    await getHeatmap([1]);
    const { sql } = vi.mocked(db.execute).mock.calls[0][0] as unknown as { sql: string };
    expect(sql).toMatch(/HAVING hour >= 7/i);
  });
});

// --- getTimeSeries ---

describe("getTimeSeries", () => {
  it("returns occupancy and capacity alongside percentage", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ timestamp: "2024-06-01T10:00:00Z", percentage: 50, occupancy: 25, capacity: 50 }])
    );
    const [result] = await getTimeSeries(1, "2024-01-01", "2024-12-31");
    expect(result).toHaveProperty("occupancy", 25);
    expect(result).toHaveProperty("capacity", 50);
    expect(result).toHaveProperty("percentage", 50);
    expect(result).toHaveProperty("timestamp");
  });
});

// --- getTodayVisitorCounts ---

describe("getTodayVisitorCounts", () => {
  it("returns venueId and total", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{ venueId: 1, total: 147 }])
    );
    const [result] = await getTodayVisitorCounts();
    expect(result).toHaveProperty("venueId", 1);
    expect(result).toHaveProperty("total", 147);
  });
});

// --- getTodayVsTypical ---

describe("getTodayVsTypical", () => {
  it("returns today's and the typical series per time bucket, preserving nulls", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([
        {
          minuteOfDay: 600,
          todayOccupancy: 40,
          todayPercentage: 50,
          typicalOccupancy: 30,
          typicalPercentage: 38,
        },
        {
          minuteOfDay: 615,
          todayOccupancy: null,
          todayPercentage: null,
          typicalOccupancy: 32,
          typicalPercentage: 40,
        },
      ])
    );
    const rows = await getTodayVsTypical(1, new Date("2026-06-20T10:00:00Z"));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ minuteOfDay: 600, todayPercentage: 50, typicalPercentage: 38 });
    expect(rows[1].todayOccupancy).toBeNull();
    expect(rows[1].typicalOccupancy).toBe(32);
  });

  it("binds the venue, today, and the N baseline same-weekday dates", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(fakeResult([]));
    // 2026-06-20 is a Saturday.
    await getTodayVsTypical(7, new Date("2026-06-20T10:00:00Z"), 5);
    const call = vi.mocked(db.execute).mock.calls[0]?.[0] as unknown as {
      sql: string;
      args: unknown[];
    };
    // The venue id is bound, not interpolated.
    expect(call.args).toContain(7);
    // Today plus the previous five Saturdays are all bound for the IN filter.
    expect(call.args).toContain("2026-06-20");
    expect(call.args).toContain("2026-06-13");
    expect(call.args).toContain("2026-05-16");
    // Today appears as a literal placeholder, never spliced into the SQL text.
    expect(call.sql).not.toContain("2026-06-20");
    expect(call.sql).toMatch(/GROUP BY minuteOfDay/i);
  });

  it("bounds the scan with a timestamp range ending at now", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(fakeResult([]));
    const now = new Date("2026-06-20T10:00:00Z");
    await getTodayVsTypical(1, now, 5);
    const { sql, args } = vi.mocked(db.execute).mock.calls[0]?.[0] as unknown as {
      sql: string;
      args: unknown[];
    };
    expect(sql).toMatch(/timestamp >= \? AND timestamp <= \?/i);
    expect(args).toContain(now.toISOString());
  });

  it("buckets the time-of-day with inlined integer division, not a bound param", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(fakeResult([]));
    await getTodayVsTypical(1, new Date("2026-06-20T10:00:00Z"), 5);
    const { sql } = vi.mocked(db.execute).mock.calls[0]?.[0] as unknown as { sql: string };
    // A bound `?` binds as REAL → float division leaves minuteOfDay un-bucketed,
    // so the bucket width must be inlined as an integer literal.
    expect(sql).toMatch(/\)\s*\/\s*15\s*\*\s*15\s+AS minuteOfDay/i);
  });
});

// --- getLiveReadings ---

describe("getLiveReadings", () => {
  it("returns all expected fields", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([{
        venueId: 1,
        venueName: "Guindalera Principal",
        occupancy: 30,
        capacity: 100,
        percentage: 30,
        timestamp: "2024-06-01T10:00:00Z",
      }])
    );
    const [result] = await getLiveReadings();
    expect(result).toHaveProperty("venueId");
    expect(result).toHaveProperty("venueName");
    expect(result).toHaveProperty("occupancy");
    expect(result).toHaveProperty("capacity");
    expect(result).toHaveProperty("percentage");
    expect(result).toHaveProperty("timestamp");
  });
});

// --- getVenues ---

describe("getVenues", () => {
  it("returns rows from the venues table when it is populated", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([
        { id: 1, name: "Alcobendas Principal" },
        { id: 2, name: "Las Rozas Principal" },
      ])
    );
    const venues = await getVenues();
    expect(venues).toEqual([
      { id: 1, name: "Alcobendas Principal" },
      { id: 2, name: "Las Rozas Principal" },
    ]);
    expect(vi.mocked(db.execute).mock.calls[0]?.[0]).toMatch(/FROM venues/i);
  });

  it("falls back to scanning readings when the venues table is empty", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce(fakeResult([])) // venues table empty
      .mockResolvedValueOnce(fakeResult([{ id: 1, name: "Alcobendas Principal" }]));
    const venues = await getVenues();
    expect(venues).toEqual([{ id: 1, name: "Alcobendas Principal" }]);
    const fallbackSql = vi.mocked(db.execute).mock.calls[1]?.[0] as string;
    expect(fallbackSql).toMatch(/SELECT DISTINCT/i);
    expect(fallbackSql).toMatch(/ORDER BY venue_id/i);
  });

  it("falls back to readings when the venues table does not exist yet", async () => {
    vi.mocked(db.execute)
      .mockRejectedValueOnce(new Error("no such table: venues"))
      .mockResolvedValueOnce(fakeResult([{ id: 2, name: "Las Rozas Principal" }]));
    const venues = await getVenues();
    expect(venues).toEqual([{ id: 2, name: "Las Rozas Principal" }]);
  });

  it("rethrows unexpected errors instead of silently falling back", async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error("SQLITE_AUTH: not authorized"));
    await expect(getVenues()).rejects.toThrow(/not authorized/);
    expect(vi.mocked(db.execute)).toHaveBeenCalledTimes(1); // no fallback scan
  });
});

describe("getVenueHours", () => {
  it("returns the mapped hours rows", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(
      fakeResult([
        { venueId: 1, dow: 1, openMin: 420, closeMin: 1380 },
        { venueId: 1, dow: 0, openMin: 540, closeMin: 1260 },
      ])
    );
    const hours = await getVenueHours();
    expect(hours).toEqual([
      { venueId: 1, dow: 1, openMin: 420, closeMin: 1380 },
      { venueId: 1, dow: 0, openMin: 540, closeMin: 1260 },
    ]);
    expect(vi.mocked(db.execute).mock.calls[0]?.[0]).toMatch(/FROM venue_hours/i);
  });

  it("returns an empty array when the table does not exist yet", async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error("no such table: venue_hours"));
    expect(await getVenueHours()).toEqual([]);
  });

  it("rethrows unexpected errors instead of masking them as 'no hours'", async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error("SQLITE_IOERR: disk I/O error"));
    await expect(getVenueHours()).rejects.toThrow(/disk I\/O/);
  });
});
