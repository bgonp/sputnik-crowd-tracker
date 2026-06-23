// Shared green→red occupancy colour scale, used by both the heatmap cells and
// the today-vs-typical line so the two charts read on the same scale: low
// occupancy is green, high is red.

/**
 * Green→red HSL hue (120 = green … 0 = red) for an occupancy percentage
 * (0–100), with sqrt easing so the lower (greener) range spreads out. This is
 * the single source of the scale's easing; callers that need a different
 * lightness/alpha (the live cards' text, the wave fill) build their own
 * `hsl(...)` from this hue.
 */
export function occupancyHue(pct: number): number {
  const clamped = Math.max(0, Math.min(100, pct));
  return 120 - Math.pow(clamped / 100, 0.5) * 120;
}

/** HSL colour for an occupancy percentage (0–100): green at 0%, red at 100%. */
export function occupancyColor(pct: number): string {
  return `hsl(${occupancyHue(pct).toFixed(1)} 70% 60%)`;
}

export interface GradientStop {
  offset: number; // 0 = top of the line's range (highest %), 1 = bottom (lowest %)
  color: string;
}

/**
 * Vertical-gradient stops for a line, colouring each height by its occupancy
 * value on the green→red scale. The stops span the line's own value range —
 * the SVG gradient's bounding box runs from the highest plotted point (offset
 * 0, top) to the lowest (offset 1, bottom) — so each point ends up the exact
 * colour `occupancyColor` would give its value.
 *
 * Returns [] when there are no finite values (nothing to colour).
 */
export function occupancyGradientStops(
  values: Array<number | null | undefined>,
  steps = 8
): GradientStop[] {
  const finite = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (finite.length === 0) return [];

  const max = Math.max(...finite);
  const min = Math.min(...finite);
  // Flat line (or single point): one solid colour, expressed as two stops.
  if (max === min) {
    const color = occupancyColor(max);
    return [
      { offset: 0, color },
      { offset: 1, color },
    ];
  }

  const stops: GradientStop[] = [];
  for (let i = 0; i <= steps; i++) {
    const offset = i / steps;
    const value = max - offset * (max - min); // top = max, bottom = min
    stops.push({ offset, color: occupancyColor(value) });
  }
  return stops;
}

/**
 * A CSS `linear-gradient(...)` spanning the full 0→100% occupancy scale, for
 * decorative fills (e.g. the title) that should read on the same green→red
 * scale as the charts. Green (low) sits at the start, red (high) at the end;
 * the colours carry `occupancyColor`'s sqrt easing.
 */
export function occupancyScaleGradientCss(direction = "to right", steps = 8): string {
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const pct = (i / steps) * 100;
    stops.push(`${occupancyColor(pct)} ${pct.toFixed(1)}%`);
  }
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}
