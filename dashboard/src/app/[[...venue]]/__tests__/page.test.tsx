import { describe, it, expect, beforeEach, vi } from "vitest";

const { getCachedVenues } = vi.hoisted(() => ({ getCachedVenues: vi.fn() }));
// Mock the cache layer so importing the page doesn't pull in the Turso client.
vi.mock("@/lib/cached-queries", () => ({
  getCachedVenues,
  getCachedLiveReadings: vi.fn(),
  getCachedTodayVisitorCounts: vi.fn(),
}));

import { generateMetadata } from "../page";

const VENUES = [
  { id: 1, name: "Alcobendas Principal" },
  { id: 5, name: "Chamberí Principal" },
];

const props = (venue?: string[]) => ({
  params: Promise.resolve({ venue }),
  searchParams: Promise.resolve({}),
});

beforeEach(() => {
  getCachedVenues.mockReset();
  getCachedVenues.mockResolvedValue(VENUES);
});

describe("generateMetadata", () => {
  it("is empty for the root (no slug) — falls back to the layout's tags", async () => {
    expect(await generateMetadata(props(undefined))).toEqual({});
  });

  it("is empty for an unknown slug", async () => {
    expect(await generateMetadata(props(["nope"]))).toEqual({});
  });

  it("is empty for a multi-segment path", async () => {
    expect(await generateMetadata(props(["a", "b"]))).toEqual({});
  });

  it("builds per-venue title, description and canonical for a known slug", async () => {
    const meta = await generateMetadata(props(["chamberi"]));
    expect(meta.title).toEqual({
      absolute: "Aforo del rocódromo Sputnik Chamberí en tiempo real",
    });
    expect(meta.description).toContain("Chamberí");
    expect(meta.alternates?.canonical).toBe("/chamberi");
    expect(meta.openGraph?.url).toBe("/chamberi");
  });
});
