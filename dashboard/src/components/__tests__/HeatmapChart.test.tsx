import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { HeatmapCell, VenueHours } from "@/lib/queries";
import { HeatmapChart } from "../HeatmapChart";

// Venue 1: every day open 07:00–23:00, so nothing gets cropped.
const allDayHours: VenueHours[] = Array.from({ length: 7 }, (_, dow) => ({
  venueId: 1,
  dow,
  openMin: 7 * 60,
  closeMin: 23 * 60,
}));

describe("HeatmapChart", () => {
  it("renders a labelled cell with its percentage and a colored background", () => {
    // Monday (day 0) at 18:00 with 42% occupancy.
    const data: HeatmapCell[] = [{ day: 0, hour: 18, avgPercentage: 42 }];
    render(<HeatmapChart data={data} venueId={1} hours={allDayHours} />);

    // The percentage label appears in the matching cell.
    expect(screen.getByText("42%")).toBeInTheDocument();

    // A cell with data is rendered colored — i.e. without the `bg-muted`
    // fallback that empty cells use. (We assert the class rather than the
    // inline color because happy-dom doesn't parse the space-separated
    // `hsl(H S% L%)` value, so `style.backgroundColor` reads back empty.)
    const cell = screen.getByText("42%").closest("[title]") as HTMLElement;
    expect(cell.getAttribute("title")).toContain("42%");
    expect(cell.className).not.toContain("bg-muted");
  });

  it("renders an empty grid (all 'Sin datos') when given no data but the venue is open", () => {
    render(<HeatmapChart data={[]} venueId={1} hours={allDayHours} />);
    // Every open cell with no reading gets the "Sin datos" title.
    expect(screen.getAllByTitle("Sin datos").length).toBeGreaterThan(0);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("blanks out cells outside the venue's open window", () => {
    // Sunday (dow 0 / day 6) closed; weekdays open 09:00–14:00.
    const hours: VenueHours[] = [
      { venueId: 1, dow: 0, openMin: 0, closeMin: 0 },
      ...[1, 2, 3, 4, 5].map((dow) => ({ venueId: 1, dow, openMin: 9 * 60, closeMin: 14 * 60 })),
      { venueId: 1, dow: 6, openMin: 9 * 60, closeMin: 14 * 60 },
    ];
    render(<HeatmapChart data={[]} venueId={1} hours={hours} />);

    // Open cells render as "Sin datos"; closed cells are blank spacers. Open
    // hours 09–13 (the 14:00 cell is closed) across Mon–Sat = 5 × 6 = 30. Sunday
    // is fully closed, so it contributes none — a count of 30 (not 35) confirms it.
    expect(screen.getAllByTitle("Sin datos").length).toBe(30);
  });

  it("treats a venue with no configured hours as fully open (fail-safe)", () => {
    render(<HeatmapChart data={[]} venueId={1} hours={[]} />);
    // 17 hours (07–23) × 7 days, all rendered as open "Sin datos" cells.
    expect(screen.getAllByTitle("Sin datos").length).toBe(17 * 7);
  });
});
