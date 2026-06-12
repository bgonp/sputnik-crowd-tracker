import { describe, it, expect } from "vitest";
import { DAY_LABELS, HOUR_LABELS } from "../labels";

describe("DAY_LABELS", () => {
  it("has exactly 7 entries", () => {
    expect(DAY_LABELS).toHaveLength(7);
  });

  it("starts on Monday", () => {
    expect(DAY_LABELS[0]).toBe("Lun");
  });

  it("ends on Sunday", () => {
    expect(DAY_LABELS[6]).toBe("Dom");
  });

  it("contains all expected days in order", () => {
    expect(DAY_LABELS).toEqual(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
  });
});

describe("HOUR_LABELS", () => {
  it("has exactly 24 entries", () => {
    expect(HOUR_LABELS).toHaveLength(24);
  });

  it("starts at 00:00", () => {
    expect(HOUR_LABELS[0]).toBe("00:00");
  });

  it("ends at 23:00", () => {
    expect(HOUR_LABELS[23]).toBe("23:00");
  });

  it("all labels match HH:00 format", () => {
    expect(HOUR_LABELS.every((l) => /^\d{2}:00$/.test(l))).toBe(true);
  });

  it("hours are zero-padded", () => {
    expect(HOUR_LABELS[1]).toBe("01:00");
    expect(HOUR_LABELS[9]).toBe("09:00");
  });
});
