import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartPlaceholder } from "../ChartPlaceholder";

describe("ChartPlaceholder", () => {
  it("shows the prompt label and icon", () => {
    render(<ChartPlaceholder icon={<span>ICON</span>} label="Pick a venue" />);
    expect(screen.getByText("Pick a venue")).toBeInTheDocument();
    expect(screen.getByText("ICON")).toBeInTheDocument();
  });

  it("draws a bar silhouette by default", () => {
    const { container } = render(<ChartPlaceholder icon={<i />} label="x" />);
    // One element per ghost bar, each sized with an inline height.
    expect(container.querySelectorAll('[style*="height"]')).toHaveLength(12);
    expect(container.querySelector('[style*="grid-template-columns"]')).toBeNull();
  });

  it("draws a grid silhouette for variant=grid", () => {
    const { container } = render(<ChartPlaceholder icon={<i />} label="x" variant="grid" />);
    const grid = container.querySelector('[style*="grid-template-columns"]');
    expect(grid).not.toBeNull();
    expect(grid!.children).toHaveLength(84); // 7 rows × 12 cols, like the heatmap
    expect(container.querySelector('[style*="height"]')).toBeNull();
  });
});
