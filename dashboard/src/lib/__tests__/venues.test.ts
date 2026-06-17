import { describe, it, expect } from "vitest";
import type { Venue } from "../queries";
import { shortVenueName, venueSlug, findVenueBySlug } from "../venues";

// Mirrors the real venue list (names as returned by the gym API).
const VENUES: Venue[] = [
  { id: 1, name: "Alcobendas Principal" },
  { id: 2, name: "Las Rozas Principal" },
  { id: 3, name: "Berango Principal" },
  { id: 4, name: "Legazpi Principal" },
  { id: 5, name: "Chamberí Principal" },
  { id: 6, name: "Guindalera Principal" },
];

describe("shortVenueName", () => {
  it("drops the ' Principal' suffix", () => {
    expect(shortVenueName("Alcobendas Principal")).toBe("Alcobendas");
    expect(shortVenueName("Las Rozas Principal")).toBe("Las Rozas");
  });
});

describe("venueSlug", () => {
  it("lowercases and drops the ' Principal' suffix", () => {
    expect(venueSlug("Alcobendas Principal")).toBe("alcobendas");
  });

  it("replaces internal whitespace with a single hyphen", () => {
    expect(venueSlug("Las Rozas Principal")).toBe("las-rozas");
  });

  it("strips diacritics", () => {
    expect(venueSlug("Chamberí Principal")).toBe("chamberi");
  });

  it("produces the expected slug for every venue", () => {
    expect(VENUES.map((v) => venueSlug(v.name))).toEqual([
      "alcobendas",
      "las-rozas",
      "berango",
      "legazpi",
      "chamberi",
      "guindalera",
    ]);
  });
});

describe("findVenueBySlug", () => {
  it("resolves a slug back to its venue", () => {
    expect(findVenueBySlug(VENUES, "las-rozas")?.id).toBe(2);
    expect(findVenueBySlug(VENUES, "chamberi")?.id).toBe(5);
  });

  it("returns undefined for an unknown slug", () => {
    expect(findVenueBySlug(VENUES, "nonexistent")).toBeUndefined();
  });
});
