import { describe, it, expect, vi } from "vitest";
import type { Client } from "@libsql/client";
import { parseThresholdMinutes, checkFreshness } from "../check-freshness.js";

describe("parseThresholdMinutes", () => {
  it("falls back to the default (15) when unset", () => {
    expect(parseThresholdMinutes(undefined)).toBe(15);
  });

  it("parses a positive number", () => {
    expect(parseThresholdMinutes("30")).toBe(30);
  });

  it("throws on zero, negative, or non-numeric values", () => {
    expect(() => parseThresholdMinutes("0")).toThrow(/Invalid FRESHNESS_THRESHOLD_MINUTES/);
    expect(() => parseThresholdMinutes("-5")).toThrow(/Invalid FRESHNESS_THRESHOLD_MINUTES/);
    expect(() => parseThresholdMinutes("abc")).toThrow(/Invalid FRESHNESS_THRESHOLD_MINUTES/);
  });
});

// A fake libsql client whose query returns a single { latest } row.
const clientReturning = (latest: unknown): Client =>
  ({ execute: vi.fn().mockResolvedValue({ rows: [{ latest }] }) }) as unknown as Client;

describe("checkFreshness", () => {
  it("is fresh when the latest reading is within the threshold", async () => {
    const now = new Date("2026-06-19T10:10:00Z");
    const result = await checkFreshness(clientReturning("2026-06-19T10:05:00Z"), now, 15);
    expect(result.stale).toBe(false);
    expect(result.ageMinutes).toBe(5);
  });

  it("is stale when the latest reading is older than the threshold", async () => {
    const now = new Date("2026-06-19T11:00:00Z");
    const result = await checkFreshness(clientReturning("2026-06-19T10:00:00Z"), now, 15);
    expect(result.stale).toBe(true);
  });

  it("is stale when there are no readings at all", async () => {
    const client = { execute: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as Client;
    const result = await checkFreshness(client, new Date("2026-06-19T11:00:00Z"), 15);
    expect(result.stale).toBe(true);
    expect(result.latest).toBeNull();
  });
});
