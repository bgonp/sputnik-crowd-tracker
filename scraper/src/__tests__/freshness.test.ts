import { describe, it, expect } from "vitest";
import { evaluateFreshness } from "../freshness.js";

const NOW = new Date("2026-06-13T18:00:00Z");

describe("evaluateFreshness", () => {
  it("flags an empty database as stale", () => {
    const r = evaluateFreshness(null, NOW, 15);
    expect(r.stale).toBe(true);
    expect(r.ageMinutes).toBeNull();
    expect(r.message).toMatch(/No readings/);
  });

  it("reports fresh data within the threshold", () => {
    const latest = new Date(NOW.getTime() - 2 * 60_000).toISOString(); // 2 min old
    const r = evaluateFreshness(latest, NOW, 15);
    expect(r.stale).toBe(false);
    expect(r.ageMinutes).toBe(2);
    expect(r.message).toMatch(/^OK/);
  });

  it("flags data older than the threshold as stale", () => {
    const latest = new Date(NOW.getTime() - 30 * 60_000).toISOString(); // 30 min old
    const r = evaluateFreshness(latest, NOW, 15);
    expect(r.stale).toBe(true);
    expect(r.ageMinutes).toBe(30);
    expect(r.message).toMatch(/^STALE/);
  });

  it("treats data exactly at the threshold as fresh (not stale)", () => {
    const latest = new Date(NOW.getTime() - 15 * 60_000).toISOString(); // exactly 15 min
    const r = evaluateFreshness(latest, NOW, 15);
    expect(r.stale).toBe(false);
    expect(r.ageMinutes).toBe(15);
  });
});
