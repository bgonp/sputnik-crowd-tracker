import { describe, it, expect } from "vitest";
import { toReadings, type ApiVenue } from "../transform.js";

const venue = (overrides: Partial<ApiVenue> = {}): ApiVenue => ({
  IdRecinto: 1,
  Recinto: "Guindalera Principal",
  Ocupacion: 45,
  Entradas: 120,
  Salidas: 75,
  Aforo: 100,
  ...overrides,
});

const TS = "2024-06-15T10:00:00.000Z";

describe("toReadings", () => {
  it("maps all Spanish fields to English", () => {
    const [result] = toReadings([venue()], TS);
    expect(result).toMatchObject({
      venueId: 1,
      venueName: "Guindalera Principal",
      occupancy: 45,
      entries: 120,
      exits: 75,
      capacity: 100,
      timestamp: TS,
    });
  });

  it("assigns a UUID v4 to each reading", () => {
    const [result] = toReadings([venue()], TS);
    expect(result!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("assigns unique IDs to each reading", () => {
    const results = toReadings([venue({ IdRecinto: 1 }), venue({ IdRecinto: 2 })], TS);
    expect(results[0]!.id).not.toBe(results[1]!.id);
  });

  it("filters out venues with zero capacity", () => {
    const venues = [venue({ IdRecinto: 1 }), venue({ IdRecinto: 2, Aforo: 0 })];
    const results = toReadings(venues, TS);
    expect(results).toHaveLength(1);
    expect(results[0]!.venueId).toBe(1);
  });

  it("propagates the timestamp to all readings", () => {
    const venues = [venue({ IdRecinto: 1 }), venue({ IdRecinto: 2 })];
    const results = toReadings(venues, TS);
    expect(results.every((r) => r.timestamp === TS)).toBe(true);
  });

  it("returns an empty array when all venues have zero capacity", () => {
    expect(toReadings([venue({ Aforo: 0 })], TS)).toHaveLength(0);
  });

  it("returns an empty array for empty input", () => {
    expect(toReadings([], TS)).toHaveLength(0);
  });
});
