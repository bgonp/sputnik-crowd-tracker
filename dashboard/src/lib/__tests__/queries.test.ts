import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResultSet } from "@libsql/client";
import { db } from "../db";
import {
  getDailyAverages,
  getHourlyAverages,
  getHeatmap,
  getTimeSeries,
  getTodayVisitorCounts,
  getLiveReadings,
  getVenues,
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
  it("returns the distinct venue id/name rows", async () => {
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
  });

  it("queries distinct venues ordered by id", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce(fakeResult([]));
    await getVenues();
    const sql = vi.mocked(db.execute).mock.calls[0]?.[0] as string;
    expect(sql).toMatch(/SELECT DISTINCT/i);
    expect(sql).toMatch(/ORDER BY venue_id/i);
  });
});
