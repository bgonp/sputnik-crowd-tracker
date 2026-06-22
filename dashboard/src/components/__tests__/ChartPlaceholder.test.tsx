import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartPlaceholder } from "../ChartPlaceholder";

describe("ChartPlaceholder", () => {
  it("shows the prompt label and icon", () => {
    render(
      <ChartPlaceholder icon={<span>ICON</span>} label="Pick a venue">
        <div>CHART</div>
      </ChartPlaceholder>
    );
    expect(screen.getByText("Pick a venue")).toBeInTheDocument();
    expect(screen.getByText("ICON")).toBeInTheDocument();
  });

  it("renders the empty chart behind the prompt, dimmed and inert", () => {
    const { container } = render(
      <ChartPlaceholder icon={<i />} label="x">
        <div data-testid="ghost-chart">CHART</div>
      </ChartPlaceholder>
    );
    // The chart frame is rendered so the placeholder mirrors the real chart...
    const ghost = screen.getByTestId("ghost-chart");
    expect(ghost).toBeInTheDocument();
    // ...but hidden from assistive tech and non-interactive (it's just scenery).
    const backdrop = ghost.parentElement!;
    expect(backdrop).toHaveAttribute("aria-hidden");
    expect(backdrop.className).toContain("pointer-events-none");
    expect(container.querySelector(".opacity-40")).toBe(backdrop);
  });
});
