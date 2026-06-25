import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { HeatmapCell, VenueHours } from "@/lib/queries";
import { HeatmapChart } from "../HeatmapChart";

// Venue 1: every day open 07:00–23:00.
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

  it("renders the 06:00 column as the leading (closed) column", () => {
    render(<HeatmapChart data={[]} venueId={1} hours={allDayHours} />);
    // The hour header starts at 06 (sliced to its first two chars).
    const headers = screen.getAllByText("06");
    expect(headers.length).toBeGreaterThan(0);
    // Monday 06:00 is before the 07:00 opening, so it's flagged closed.
    expect(screen.getByTitle("Lun 06:00: cerrado")).toBeInTheDocument();
  });

  it("renders open cells with no reading as 'Sin datos', not as closed", () => {
    render(<HeatmapChart data={[]} venueId={1} hours={allDayHours} />);
    // Open hours 07–22 across all 7 days = 16 × 7 = 112 (06:00 and 23:00 are closed).
    expect(screen.getAllByTitle("Sin datos").length).toBe(112);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("flags cells outside the venue's open window as closed", () => {
    // Sunday (dow 0 / day 6) closed; weekdays + Saturday open 09:00–14:00.
    const hours: VenueHours[] = [
      { venueId: 1, dow: 0, openMin: 0, closeMin: 0 },
      ...[1, 2, 3, 4, 5].map((dow) => ({ venueId: 1, dow, openMin: 9 * 60, closeMin: 14 * 60 })),
      { venueId: 1, dow: 6, openMin: 9 * 60, closeMin: 14 * 60 },
    ];
    render(<HeatmapChart data={[]} venueId={1} hours={hours} />);

    // Open hours 09–13 (the 14:00 cell is closed) across Mon–Sat = 5 × 6 = 30.
    // Sunday is fully closed, so it contributes none — a count of 30 confirms it.
    expect(screen.getAllByTitle("Sin datos").length).toBe(30);

    // The early-morning hours and Sunday render as flagged-closed cells.
    expect(screen.getByTitle("Lun 07:00: cerrado")).toBeInTheDocument();
    expect(screen.getByTitle("Dom 12:00: cerrado")).toBeInTheDocument();
  });

  it("treats a venue with no configured hours as fully open (fail-safe)", () => {
    render(<HeatmapChart data={[]} venueId={1} hours={[]} />);
    // 18 hours (06–23) × 7 days, all rendered as open "Sin datos" cells.
    expect(screen.getAllByTitle("Sin datos").length).toBe(18 * 7);
    expect(screen.queryByTitle(/cerrado$/)).not.toBeInTheDocument();
  });

  it("highlights today's row: bold label and ring on the row container", () => {
    // todayWeekday=2 → Wednesday ("Mié")
    render(<HeatmapChart data={[]} venueId={1} hours={allDayHours} todayWeekday={2} />);

    const mie = screen.getByText("Mié");
    expect(mie.className).toContain("font-semibold");
    expect(mie.className).toContain("text-foreground");
    // Row container (parent of the label) carries the background tint.
    expect(mie.parentElement?.className).toContain("bg-foreground");

    const lun = screen.getByText("Lun");
    expect(lun.className).not.toContain("font-semibold");
    expect(lun.className).toContain("text-muted-foreground");
    expect(lun.parentElement?.className).not.toContain("bg-foreground");
  });

  it("renders all row labels as muted when todayWeekday is not provided", () => {
    render(<HeatmapChart data={[]} venueId={1} hours={allDayHours} />);
    const lun = screen.getByText("Lun");
    expect(lun.className).toContain("text-muted-foreground");
    expect(lun.className).not.toContain("font-semibold");
    expect(lun.parentElement?.className).not.toContain("bg-foreground");
  });

  it("highlights the current hour: bold column header and ring on the today cell", () => {
    // todayWeekday=0 (Mon), currentHour=18 → "Sin datos" cell at Mon 18:00 gets a ring.
    render(
      <HeatmapChart data={[]} venueId={1} hours={allDayHours} todayWeekday={0} currentHour={18} />
    );

    // Column header "18" is bold + foreground.
    const headers = screen.getAllByText("18");
    expect(headers[0]?.className).toContain("font-semibold");
    expect(headers[0]?.className).toContain("text-foreground");

    // Other column headers remain muted.
    const headers10 = screen.getAllByText("10");
    expect(headers10[0]?.className).not.toContain("font-semibold");

    // The Mon 18:00 cell (today's row, current hour) has a ring. The ringed
    // cell is uniquely identified by having ring-foreground in its className.
    const ringedCells = document.querySelectorAll("[class*='ring-foreground']");
    // Only the current-hour cell carries the ring (the row uses a bg tint instead).
    expect(ringedCells.length).toBe(1);
  });

  it("does not ring any cell when currentHour is not provided", () => {
    render(<HeatmapChart data={[]} venueId={1} hours={allDayHours} todayWeekday={0} />);
    // The row uses a bg tint, not a ring — so no ring-foreground elements at all.
    const ringedCells = document.querySelectorAll("[class*='ring-foreground']");
    expect(ringedCells.length).toBe(0);
  });
});
