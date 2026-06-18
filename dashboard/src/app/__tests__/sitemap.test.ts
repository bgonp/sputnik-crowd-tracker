import { describe, it, expect, beforeEach, vi } from "vitest";

const { getCachedVenues } = vi.hoisted(() => ({ getCachedVenues: vi.fn() }));
vi.mock("@/lib/cached-queries", () => ({ getCachedVenues }));
vi.mock("@/lib/site", () => ({ getSiteUrl: () => "https://aforosputnik.com" }));

import sitemap from "../sitemap";

beforeEach(() => {
  getCachedVenues.mockReset();
});

describe("sitemap", () => {
  it("leads with the homepage at priority 1 and lists each venue slug at 0.8", async () => {
    getCachedVenues.mockResolvedValue([
      { id: 1, name: "Alcobendas Principal" },
      { id: 5, name: "Chamberí Principal" },
    ]);
    const entries = await sitemap();
    expect(entries[0]).toMatchObject({ url: "https://aforosputnik.com", priority: 1 });
    expect(entries.slice(1)).toEqual([
      { url: "https://aforosputnik.com/alcobendas", changeFrequency: "hourly", priority: 0.8 },
      { url: "https://aforosputnik.com/chamberi", changeFrequency: "hourly", priority: 0.8 },
    ]);
  });

  it("degrades to a home-only sitemap when the venue list can't be fetched", async () => {
    getCachedVenues.mockRejectedValue(new Error("turso down"));
    const entries = await sitemap();
    expect(entries).toEqual([
      { url: "https://aforosputnik.com", changeFrequency: "hourly", priority: 1 },
    ]);
  });
});
