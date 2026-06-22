import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LiveReading, DailyVisitorCount } from "@/lib/queries";

// Mock the cache layer so importing the page doesn't pull in the Turso client.
const { getCachedVenues, getCachedVenueHours, getCachedLiveReadings, getCachedTodayVisitorCounts } =
  vi.hoisted(() => ({
    getCachedVenues: vi.fn(),
    getCachedVenueHours: vi.fn(),
    getCachedLiveReadings: vi.fn(),
    getCachedTodayVisitorCounts: vi.fn(),
  }));
vi.mock("@/lib/cached-queries", () => ({
  getCachedVenues,
  getCachedVenueHours,
  getCachedLiveReadings,
  getCachedTodayVisitorCounts,
  // Pulled in transitively by the section components rendered on a venue path.
  getCachedHeatmap: vi.fn().mockResolvedValue([]),
  getCachedTodayVsTypical: vi.fn().mockResolvedValue([]),
  getCachedDatesWithData: vi.fn().mockResolvedValue([]),
}));

// `notFound` / `permanentRedirect` halt rendering in Next by throwing; mirror
// that so the page's control flow stops at the call site, like in production.
const { notFound, permanentRedirect } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("next/navigation", () => ({
  notFound,
  permanentRedirect,
  // Hooks used by the client children rendered inside <Home/>.
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

import Home from "../page";

const VENUES = [
  { id: 1, name: "Alcobendas Principal" },
  { id: 5, name: "Chamberí Principal" },
];
const LIVE: LiveReading[] = [
  {
    venueId: 1,
    venueName: "Alcobendas Principal",
    occupancy: 100,
    capacity: 200,
    percentage: 50,
    timestamp: "2026-06-18T10:00:00Z",
  },
  {
    venueId: 5,
    venueName: "Chamberí Principal",
    occupancy: 30,
    capacity: 300,
    percentage: 10,
    timestamp: "2026-06-18T10:00:00Z",
  },
];
const TODAY: DailyVisitorCount[] = [{ venueId: 1, total: 420 }];

const props = (venue?: string[], searchParams: Record<string, string> = {}) => ({
  params: Promise.resolve({ venue }),
  searchParams: Promise.resolve(searchParams),
});

beforeEach(() => {
  getCachedVenues.mockReset().mockResolvedValue(VENUES);
  getCachedVenueHours.mockReset().mockResolvedValue([]);
  getCachedLiveReadings.mockReset().mockResolvedValue(LIVE);
  getCachedTodayVisitorCounts.mockReset().mockResolvedValue(TODAY);
  notFound.mockClear();
  permanentRedirect.mockClear();
});

// Server components are async functions returning an element; await then render.
async function renderHome(...args: Parameters<typeof props>) {
  const element = await Home(props(...args));
  render(element);
}

describe("Home (root overview)", () => {
  it("renders the live cards for every venue and chart placeholders (no per-venue charts)", async () => {
    await renderHome();

    // Live cards for both venues (the " Principal" suffix is stripped).
    expect(screen.getByText("Alcobendas")).toBeInTheDocument();
    expect(screen.getByText("Chamberí")).toBeInTheDocument();

    // Both chart cards fall back to their placeholder prompts.
    expect(
      screen.getByText("Selecciona un rocódromo para ver su mapa de calor")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Selecciona un rocódromo para comparar hoy con su media")
    ).toBeInTheDocument();

    // Titles carry no venue suffix on the overview.
    expect(screen.getByText("Mapa de calor")).toBeInTheDocument();
    expect(screen.getByText("Hoy vs. media")).toBeInTheDocument();

    expect(notFound).not.toHaveBeenCalled();
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it("does not query the venue list on the bare root", async () => {
    await renderHome();
    expect(getCachedVenues).not.toHaveBeenCalled();
  });
});

describe("Home (venue path)", () => {
  it("renders the named charts for a known slug", async () => {
    await renderHome(["chamberi"]);

    // Card titles now carry the venue name.
    expect(screen.getByText("Mapa de calor — Chamberí")).toBeInTheDocument();
    expect(screen.getByText("Hoy vs. media — Chamberí")).toBeInTheDocument();

    // The placeholder prompts are gone (real chart sections render instead).
    expect(
      screen.queryByText("Selecciona un rocódromo para ver su mapa de calor")
    ).not.toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("404s on an unknown slug", async () => {
    await expect(renderHome(["does-not-exist"])).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("404s on a multi-segment path without touching the DB", async () => {
    await expect(renderHome(["a", "b"])).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
    expect(getCachedVenues).not.toHaveBeenCalled();
  });
});

describe("Home (legacy ?venue= redirect)", () => {
  it("308-redirects a known legacy venue id to its slug path", async () => {
    await expect(renderHome(undefined, { venue: "5" })).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(permanentRedirect).toHaveBeenCalledWith("/chamberi");
  });

  it("preserves a forwarded unit in the redirect target", async () => {
    await expect(
      renderHome(undefined, { venue: "5", unit: "absolute" })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(permanentRedirect).toHaveBeenCalledWith("/chamberi?unit=absolute");
  });

  it("ignores an unknown legacy venue id and renders the overview", async () => {
    await renderHome(undefined, { venue: "999" });
    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(
      screen.getByText("Selecciona un rocódromo para ver su mapa de calor")
    ).toBeInTheDocument();
  });
});
