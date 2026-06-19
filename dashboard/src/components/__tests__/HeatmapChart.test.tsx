import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { HeatmapCell } from "@/lib/queries";
import { HeatmapChart } from "../HeatmapChart";

describe("HeatmapChart", () => {
  it("renders a labelled cell with its percentage and a colored background", () => {
    // Monday (day 0) at 18:00 with 42% occupancy.
    const data: HeatmapCell[] = [{ day: 0, hour: 18, avgPercentage: 42 }];
    render(<HeatmapChart data={data} />);

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

  it("renders an empty grid (all 'Sin datos') when given no data", () => {
    render(<HeatmapChart data={[]} />);
    // Every cell with no reading gets the "Sin datos" title.
    expect(screen.getAllByTitle("Sin datos").length).toBeGreaterThan(0);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});
