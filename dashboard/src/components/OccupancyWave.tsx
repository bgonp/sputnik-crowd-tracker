"use client";

import { useEffect, useRef } from "react";
import {
  crestColor,
  fillStops,
  surfaceY,
  waveAmplitude,
  waveDisplacement,
  waveLevel,
} from "@/lib/occupancy-wave";

interface Props {
  /** Occupancy percentage (0–100) the water fills to. */
  pct: number;
  /** Whether the venue is open; closed cards show a shallow, still puddle. */
  open: boolean;
  /** Stable per-card phase offset so adjacent cards don't ripple in lock-step. */
  seed?: number;
}

/**
 * A decorative canvas that fills its (relatively-positioned) parent card with
 * water to the occupancy level, with a gently drifting wave surface. Honours
 * `prefers-reduced-motion` by freezing the wave, and reads its latest props
 * from a ref so the 60s refresh updates the level without restarting the loop.
 */
export function OccupancyWave({ pct, open, seed = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ pct, open, seed });
  // Keep the latest props available to the animation loop without restarting it
  // (and without touching the ref during render, which React disallows).
  useEffect(() => {
    stateRef.current = { pct, open, seed };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return; // e.g. happy-dom has no 2d context
    // Bind to non-null locals so the nested draw/resize closures stay narrowed.
    const cv = canvas;
    const c = ctx;

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    let raf = 0;
    let startMs: number | null = null;
    let cssW = 0;
    let cssH = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      cssW = cv.clientWidth;
      cssH = cv.clientHeight;
      cv.width = Math.max(1, Math.round(cssW * dpr));
      cv.height = Math.max(1, Math.round(cssH * dpr));
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(t: number) {
      const { pct, open, seed } = stateRef.current;
      const w = cssW;
      const h = cssH;
      c.clearRect(0, 0, w, h);
      if (w === 0 || h === 0) return;

      const level = waveLevel(pct, open);
      const baseY = surfaceY(level, h);
      const amp = waveAmplitude(level, open);
      const surfaceAt = (x: number) => baseY + waveDisplacement(x, w, t, amp, seed);

      // Body of water: a subtle vertical gradient under the surface.
      const stops = fillStops(pct, open);
      const grad = c.createLinearGradient(0, baseY - amp, 0, h);
      grad.addColorStop(0, stops.top);
      grad.addColorStop(1, stops.bottom);
      c.beginPath();
      c.moveTo(0, h);
      c.lineTo(0, surfaceAt(0));
      for (let x = 0; x <= w; x += 4) c.lineTo(x, surfaceAt(x));
      c.lineTo(w, h);
      c.closePath();
      c.fillStyle = grad;
      c.fill();

      // Brighter crest traced along the waterline (skipped for the flat puddle).
      if (open) {
        c.beginPath();
        c.moveTo(0, surfaceAt(0));
        for (let x = 0; x <= w; x += 4) c.lineTo(x, surfaceAt(x));
        c.lineWidth = 1.25;
        c.strokeStyle = crestColor(pct);
        c.stroke();
      }
    }

    function frame(ms: number) {
      if (startMs === null) startMs = ms;
      draw((ms - startMs) / 1000);
      raf = requestAnimationFrame(frame);
    }

    resize();
    if (reduceMotion) draw(0);
    else raf = requestAnimationFrame(frame);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            resize();
            if (reduceMotion) draw(0);
          })
        : null;
    ro?.observe(cv);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
