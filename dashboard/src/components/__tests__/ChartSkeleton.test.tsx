import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ChartSkeleton } from "../ChartSkeleton";

describe("ChartSkeleton", () => {
  it("renders a pulsing block with the default height", () => {
    const { container } = render(<ChartSkeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse", "rounded-md", "bg-muted", "h-52");
  });

  it("accepts a custom className", () => {
    const { container } = render(<ChartSkeleton className="h-24" />);
    expect(container.firstChild).toHaveClass("h-24");
    expect(container.firstChild).not.toHaveClass("h-52");
  });
});
