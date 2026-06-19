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

  it("treats an unparseable latest timestamp as stale", () => {
    const r = evaluateFreshness("not-a-date", NOW, 15);
    expect(r.stale).toBe(true);
    expect(r.ageMinutes).toBeNull();
  });

  it("does not round down a slightly-stale age below the threshold", () => {
    // 15.04 min old (15 min + 2.4s) rounds to 15.0 if rounding is applied too early.
    const latest = new Date(NOW.getTime() - (15 * 60_000 + 2_400)).toISOString();
    const r = evaluateFreshness(latest, NOW, 15);
    expect(r.stale).toBe(true);
  });

  it("downgrades a stale verdict to OK when all venues are closed", () => {
    const latest = new Date(NOW.getTime() - 30 * 60_000).toISOString(); // 30 min old
    const r = evaluateFreshness(latest, NOW, 15, /* expectedOpen */ false);
    expect(r.stale).toBe(false);
    expect(r.ageMinutes).toBe(30); // still reported, just not alarmed
    expect(r.message).toMatch(/closed/);
    expect(r.message).not.toMatch(/STALE/); // no contradictory "OK … STALE:" text
  });

  it("treats an empty database as OK when all venues are closed", () => {
    const r = evaluateFreshness(null, NOW, 15, /* expectedOpen */ false);
    expect(r.stale).toBe(false);
    expect(r.message).toMatch(/closed/);
  });

  it("still reports fresh data as fresh while closed (no false 'closed' message)", () => {
    const latest = new Date(NOW.getTime() - 2 * 60_000).toISOString();
    const r = evaluateFreshness(latest, NOW, 15, /* expectedOpen */ false);
    expect(r.stale).toBe(false);
    expect(r.message).toMatch(/^OK/);
    expect(r.message).not.toMatch(/closed/);
  });
});
