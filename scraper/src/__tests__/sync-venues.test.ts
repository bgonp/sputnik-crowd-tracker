import { describe, it, expect, vi } from "vitest";
import type { Client } from "@libsql/client";
import { buildVenueSyncPlan, readObservedVenues, syncVenues } from "../sync-venues.js";

const UPDATED_AT = "2026-06-20T00:00:00.000Z";

describe("buildVenueSyncPlan", () => {
  it("emits a venues row plus 7 hours rows for each known venue", () => {
    const plan = buildVenueSyncPlan(
      [
        { venueId: 2, name: "Las Rozas Principal", capacity: 489 },
        { venueId: 3, name: "Berango Principal", capacity: 290 },
      ],
      UPDATED_AT,
    );

    expect(plan.venues).toHaveLength(2);
    expect(plan.hours).toHaveLength(14); // 2 venues × 7 days
    expect(plan.unknown).toEqual([]);
    expect(plan.venues[0]).toEqual({ venueId: 2, name: "Las Rozas Principal", capacity: 489, updatedAt: UPDATED_AT });
  });

  it("maps per-day windows correctly (Las Rozas opens 08:00 Sunday, 07:00 weekday)", () => {
    const plan = buildVenueSyncPlan([{ venueId: 2, name: "Las Rozas Principal", capacity: 489 }], UPDATED_AT);
    const sunday = plan.hours.find((h) => h.dow === 0);
    const weekday = plan.hours.find((h) => h.dow === 3);
    expect(sunday).toEqual({ venueId: 2, dow: 0, openMin: 8 * 60, closeMin: 21 * 60 });
    expect(weekday).toEqual({ venueId: 2, dow: 3, openMin: 7 * 60, closeMin: 23 * 60 });
  });

  it("records a venue with no configured schedule but emits no hours for it", () => {
    const plan = buildVenueSyncPlan(
      [
        { venueId: 2, name: "Las Rozas Principal", capacity: 489 },
        { venueId: 99, name: "Mystery Wall", capacity: 100 },
      ],
      UPDATED_AT,
    );
    expect(plan.venues).toHaveLength(2); // unknown venue still gets an identity row
    expect(plan.hours).toHaveLength(7); // only Las Rozas
    expect(plan.unknown).toEqual(["Mystery Wall"]);
  });
});

describe("readObservedVenues", () => {
  it("maps rows and tolerates a null capacity", async () => {
    const client = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          { venueId: 2, name: "Las Rozas Principal", capacity: 489 },
          { venueId: 7, name: "Ghost Principal", capacity: null },
        ],
      }),
    } as unknown as Client;

    const observed = await readObservedVenues(client);
    expect(observed).toEqual([
      { venueId: 2, name: "Las Rozas Principal", capacity: 489 },
      { venueId: 7, name: "Ghost Principal", capacity: null },
    ]);
  });
});

describe("syncVenues", () => {
  it("reads observed venues and upserts venues + venue_hours in one batch", async () => {
    const batch = vi.fn().mockResolvedValue(undefined);
    const client = {
      execute: vi.fn().mockResolvedValue({
        rows: [{ venueId: 3, name: "Berango Principal", capacity: 290 }],
      }),
      batch,
    } as unknown as Client;

    const plan = await syncVenues(client, new Date(UPDATED_AT));

    expect(plan.venues).toHaveLength(1);
    expect(plan.hours).toHaveLength(7);
    expect(batch).toHaveBeenCalledTimes(1);
    const [statements, mode] = batch.mock.calls[0]!;
    expect(mode).toBe("write");
    // 1 DELETE (clear venue_hours) + 1 venue upsert + 7 hours inserts
    expect(statements).toHaveLength(1 + 1 + 7);
    // venue_hours is cleared first so stale/renamed schedules can't linger.
    expect(statements[0].sql).toMatch(/DELETE FROM venue_hours/i);
  });

  it("does not call batch when there are no observed venues", async () => {
    const batch = vi.fn();
    const client = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      batch,
    } as unknown as Client;

    const plan = await syncVenues(client, new Date(UPDATED_AT));
    expect(plan.venues).toEqual([]);
    expect(batch).not.toHaveBeenCalled();
  });
});
