import { describe, it, expect } from "vitest";
import { planIngest } from "../ingest-plan.js";
import { type ApiVenue } from "../transform.js";
import { type MadridMoment } from "../open-hours.js";

const venue = (overrides: Partial<ApiVenue> = {}): ApiVenue => ({
  IdRecinto: 1,
  Recinto: "Guindalera Principal",
  Ocupacion: 45,
  Entradas: 120,
  Salidas: 75,
  Aforo: 100,
  ...overrides,
});

const TS = "2026-06-19T10:00:00.000Z";

// Build a Madrid moment without going through a Date.
const at = (dow: number, hour: number, minute = 0): MadridMoment => ({
  dow,
  minuteOfDay: hour * 60 + minute,
});

const OPEN = at(5, 12); // Friday noon — every venue is open.
const CLOSED = at(5, 3); // Friday 03:00 — every venue is closed.

describe("planIngest", () => {
  it("flags an empty payload as a transient blip, not a closed gym", () => {
    expect(planIngest([], TS, OPEN)).toEqual({ kind: "empty-payload" });
  });

  it("treats empty payload as empty-payload even when all venues would be closed", () => {
    // The distinction is the whole point: no venues returned is never
    // 'no-open-venues', regardless of the moment.
    expect(planIngest([], TS, CLOSED)).toEqual({ kind: "empty-payload" });
  });

  it("returns readings to insert when venues are open", () => {
    const plan = planIngest([venue()], TS, OPEN);
    expect(plan.kind).toBe("insert");
    if (plan.kind !== "insert") throw new Error("expected insert");
    expect(plan.readings).toHaveLength(1);
    expect(plan.readings[0]).toMatchObject({ venueName: "Guindalera Principal", capacity: 100 });
  });

  it("reports no-open-venues (with fetched count) when a non-empty payload is all closed", () => {
    const plan = planIngest([venue(), venue({ IdRecinto: 2 })], TS, CLOSED);
    expect(plan).toEqual({ kind: "no-open-venues", fetched: 2 });
  });

  it("reports no-open-venues when all returned venues have zero capacity", () => {
    // toReadings drops zero-capacity venues, so a non-empty payload can still
    // yield zero readings — distinct from an empty payload.
    const plan = planIngest([venue({ Aforo: 0 })], TS, OPEN);
    expect(plan).toEqual({ kind: "no-open-venues", fetched: 1 });
  });

  it("inserts only the open venues when some are individually closed", () => {
    // Saturday 21:30: Alcobendas (Sat closes 21:00) is closed, Las Rozas
    // (Sat closes 22:00) is open.
    const saturdayLate = at(6, 21, 30);
    const plan = planIngest(
      [venue({ IdRecinto: 1, Recinto: "Alcobendas" }), venue({ IdRecinto: 2, Recinto: "Las Rozas Principal" })],
      TS,
      saturdayLate
    );
    expect(plan.kind).toBe("insert");
    if (plan.kind !== "insert") throw new Error("expected insert");
    expect(plan.readings).toHaveLength(1);
    expect(plan.readings[0]!.venueName).toBe("Las Rozas Principal");
  });
});
