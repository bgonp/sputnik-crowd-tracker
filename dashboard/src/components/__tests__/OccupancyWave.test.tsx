import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { OccupancyWave } from "../OccupancyWave";

// The canvas drawing itself isn't exercised here — happy-dom has no 2d context,
// and the geometry/colour is covered by lib/__tests__/occupancy-wave.test.ts.
// These tests just pin the contract the cards rely on: a decorative, hidden,
// absolutely-positioned canvas that mounts without throwing.
describe("OccupancyWave", () => {
  it("renders a decorative, hidden canvas that fills its parent", () => {
    const { container } = render(<OccupancyWave pct={64} open seed={3} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas?.className).toContain("absolute");
    expect(canvas?.className).toContain("pointer-events-none");
  });

  it("mounts without a 2d context (and for a closed venue) without throwing", () => {
    expect(() => render(<OccupancyWave pct={0} open={false} />)).not.toThrow();
  });
});
