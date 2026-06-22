import { describe, it, expect } from "vitest";
import {
  occupancyColor,
  occupancyGradientStops,
  occupancyScaleGradientCss,
} from "../occupancy-color";

describe("occupancyColor", () => {
  it("maps 0% to green (hue 120) and 100% to red (hue 0)", () => {
    expect(occupancyColor(0)).toBe("hsl(120.0 70% 60%)");
    expect(occupancyColor(100)).toBe("hsl(0.0 70% 60%)");
  });

  it("clamps out-of-range values to the 0–100 ends", () => {
    expect(occupancyColor(-20)).toBe(occupancyColor(0));
    expect(occupancyColor(150)).toBe(occupancyColor(100));
  });

  it("eases toward green so mid values stay below the linear midpoint hue", () => {
    // sqrt easing: 50% → hue = 120 - sqrt(0.5)*120 ≈ 35.1, not the linear 60.
    expect(occupancyColor(50)).toBe("hsl(35.1 70% 60%)");
  });
});

describe("occupancyGradientStops", () => {
  it("returns no stops when there are no finite values", () => {
    expect(occupancyGradientStops([null, undefined])).toEqual([]);
    expect(occupancyGradientStops([])).toEqual([]);
  });

  it("returns a single flat colour (two stops) for a constant line", () => {
    const stops = occupancyGradientStops([40, 40, null, 40]);
    expect(stops).toEqual([
      { offset: 0, color: occupancyColor(40) },
      { offset: 1, color: occupancyColor(40) },
    ]);
  });

  it("runs from the max value at the top (offset 0) to the min at the bottom", () => {
    const stops = occupancyGradientStops([10, 90, 50], 4);
    expect(stops).toHaveLength(5);
    expect(stops[0]).toEqual({ offset: 0, color: occupancyColor(90) });
    expect(stops[stops.length - 1]).toEqual({ offset: 1, color: occupancyColor(10) });
    // Midpoint offset maps to the midpoint value (90 → 10 spans 80).
    expect(stops[2]).toEqual({ offset: 0.5, color: occupancyColor(50) });
  });
});

describe("occupancyScaleGradientCss", () => {
  it("spans the full 0→100% scale, green start to red end", () => {
    const css = occupancyScaleGradientCss("to right", 4);
    expect(css).toBe(
      `linear-gradient(to right, ${occupancyColor(0)} 0.0%, ${occupancyColor(25)} 25.0%, ${occupancyColor(50)} 50.0%, ${occupancyColor(75)} 75.0%, ${occupancyColor(100)} 100.0%)`
    );
  });

  it("defaults to a left-to-right gradient", () => {
    expect(occupancyScaleGradientCss()).toContain("linear-gradient(to right,");
  });

  it("honours a custom direction", () => {
    expect(occupancyScaleGradientCss("135deg")).toContain("linear-gradient(135deg,");
  });
});
