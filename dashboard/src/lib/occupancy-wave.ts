// Geometry and colour for the live cards' "tank" background: each card fills
// with water to its occupancy level, and the surface drifts as a gentle wave.
// Pure functions only — the canvas/animation wiring lives in
// `components/OccupancyWave.tsx`, which draws frame-by-frame from these.

import { occupancyHue } from "./occupancy-color";

/** Closed venues show a shallow, still puddle rather than an empty card. */
export const PUDDLE_LEVEL = 6;

/** Lightness of the water fill; a mid value that reads on both light and dark cards. */
const WATER_LIGHT = 55;

// Fill is a subtle vertical gradient, fainter at the surface, denser at the
// floor — kept low so the percentage stays the focus.
const FILL_ALPHA_TOP = 0.08;
const FILL_ALPHA_BOTTOM = 0.2;
const PUDDLE_ALPHA_TOP = 0.05;
const PUDDLE_ALPHA_BOTTOM = 0.09;
/** Opacity of the brighter crest line drawn along the waterline. */
export const CREST_ALPHA = 0.28;

/**
 * The water level (0–100) a card fills to: the occupancy when open (clamped to
 * the valid range), a shallow puddle when closed.
 */
export function waveLevel(pct: number, open: boolean): number {
  if (!open) return PUDDLE_LEVEL;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Y of the still waterline, in px from the top of a card `height` px tall.
 * 0% sits at the floor (`height`), 100% at the very top (0).
 */
export function surfaceY(level: number, height: number): number {
  return height - (level / 100) * height;
}

/** Wave amplitude in px: grows gently with the fill, near-flat when closed/empty. */
export function waveAmplitude(level: number, open: boolean): number {
  if (!open) return 1.5;
  return Math.min(7, 2 + level * 0.06);
}

/**
 * Vertical displacement (px) of the water surface at horizontal position `x`
 * and time `t` (seconds). Two crossing sine waves of different wavelength and
 * speed make the surface read as water rather than a sliding bar; `seed`
 * offsets the phase so adjacent cards don't ripple in lock-step.
 */
export function waveDisplacement(
  x: number,
  width: number,
  t: number,
  amp: number,
  seed: number
): number {
  const k1 = (2 * Math.PI) / (width * 0.9);
  const k2 = (2 * Math.PI) / (width * 0.55);
  return (
    amp * Math.sin(k1 * x + t * 0.9 + seed * 1.3) +
    amp * 0.5 * Math.sin(k2 * x - t * 1.3 + seed * 2.7)
  );
}

/** HSL water colour for an occupancy %, at the given alpha. */
export function waterColor(pct: number, alpha: number): string {
  return `hsl(${occupancyHue(pct).toFixed(1)} 70% ${WATER_LIGHT}% / ${alpha})`;
}

/** Top/bottom fill colours for the body of water (denser at the floor). */
export function fillStops(pct: number, open: boolean): { top: string; bottom: string } {
  return {
    top: waterColor(pct, open ? FILL_ALPHA_TOP : PUDDLE_ALPHA_TOP),
    bottom: waterColor(pct, open ? FILL_ALPHA_BOTTOM : PUDDLE_ALPHA_BOTTOM),
  };
}

/** Slightly brighter colour for the crest line traced along the waterline. */
export function crestColor(pct: number): string {
  return waterColor(pct, CREST_ALPHA);
}
