import { describe, it, expect } from "vitest";
import {
  CREST_ALPHA,
  PUDDLE_LEVEL,
  crestColor,
  fillStops,
  surfaceY,
  waterColor,
  waveAmplitude,
  waveDisplacement,
  waveLevel,
} from "../occupancy-wave";
import { occupancyHue } from "../occupancy-color";

describe("waveLevel", () => {
  it("uses the occupancy when open, clamped to 0–100", () => {
    expect(waveLevel(40, true)).toBe(40);
    expect(waveLevel(-10, true)).toBe(0);
    expect(waveLevel(150, true)).toBe(100);
  });

  it("falls back to a shallow puddle when closed", () => {
    expect(waveLevel(80, false)).toBe(PUDDLE_LEVEL);
    expect(waveLevel(0, false)).toBe(PUDDLE_LEVEL);
  });
});

describe("surfaceY", () => {
  it("puts 0% at the floor and 100% at the top of the card", () => {
    expect(surfaceY(0, 200)).toBe(200);
    expect(surfaceY(100, 200)).toBe(0);
  });

  it("places intermediate levels proportionally", () => {
    expect(surfaceY(50, 200)).toBe(100);
    expect(surfaceY(25, 120)).toBe(90);
  });
});

describe("waveAmplitude", () => {
  it("is near-flat when closed", () => {
    expect(waveAmplitude(6, false)).toBe(1.5);
  });

  it("grows gently with the fill but caps so it never overflows the card", () => {
    expect(waveAmplitude(0, true)).toBe(2);
    expect(waveAmplitude(50, true)).toBeCloseTo(5);
    expect(waveAmplitude(100, true)).toBe(7); // 2 + 100*0.06 = 8, capped at 7
  });
});

describe("waveDisplacement", () => {
  it("is flat (0) at zero amplitude regardless of x and t", () => {
    expect(waveDisplacement(0, 280, 0, 0, 1)).toBe(0);
    expect(waveDisplacement(140, 280, 3.2, 0, 5)).toBe(0);
  });

  it("never exceeds the combined amplitude of the two sines (1.5×amp)", () => {
    const amp = 6;
    for (let x = 0; x <= 280; x += 10) {
      for (const t of [0, 0.7, 2.5, 9]) {
        expect(Math.abs(waveDisplacement(x, 280, t, amp, 2))).toBeLessThanOrEqual(amp * 1.5 + 1e-9);
      }
    }
  });

  it("is deterministic for the same inputs and varies over time", () => {
    const a = waveDisplacement(40, 280, 1.0, 5, 3);
    expect(waveDisplacement(40, 280, 1.0, 5, 3)).toBe(a);
    expect(waveDisplacement(40, 280, 2.0, 5, 3)).not.toBe(a);
  });
});

describe("water colours", () => {
  it("builds the fill from the shared occupancy hue", () => {
    expect(waterColor(0, 0.2)).toBe(`hsl(${occupancyHue(0).toFixed(1)} 70% 55% / 0.2)`);
    expect(waterColor(100, 0.08)).toBe("hsl(0.0 70% 55% / 0.08)");
  });

  it("fills denser at the floor than at the surface, and fainter when closed", () => {
    const open = fillStops(70, true);
    const closed = fillStops(70, false);
    expect(open.top).toBe(waterColor(70, 0.08));
    expect(open.bottom).toBe(waterColor(70, 0.2));
    expect(closed.top).toBe(waterColor(70, 0.05));
    expect(closed.bottom).toBe(waterColor(70, 0.09));
  });

  it("draws the crest brighter than the fill", () => {
    expect(crestColor(50)).toBe(waterColor(50, CREST_ALPHA));
  });
});
