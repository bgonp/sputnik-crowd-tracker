import { describe, it, expect } from "vitest";
import {
  DAY_LABELS,
  HOUR_LABELS,
  OPENING_HOUR,
  FULL_DAY_LABELS,
  typicalAverageLabel,
} from "../labels";

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

describe("OPENING_HOUR", () => {
  it("is 7 (gym opens at 07:00 Madrid time)", () => {
    expect(OPENING_HOUR).toBe(7);
  });

  it("is a valid index into HOUR_LABELS", () => {
    expect(HOUR_LABELS[OPENING_HOUR]).toBe("07:00");
  });
});

describe("FULL_DAY_LABELS", () => {
  it("is Monday-indexed and aligned with DAY_LABELS", () => {
    expect(FULL_DAY_LABELS).toHaveLength(7);
    expect(FULL_DAY_LABELS[0]).toBe("lunes");
    expect(FULL_DAY_LABELS[5]).toBe("sábado");
    expect(FULL_DAY_LABELS[6]).toBe("domingo");
  });
});

describe("typicalAverageLabel", () => {
  it("pluralises vowel-ending weekdays (sábado → sábados)", () => {
    expect(typicalAverageLabel(5, 5)).toBe("Media de 5 sábados");
    expect(typicalAverageLabel(6, 3)).toBe("Media de 3 domingos");
  });

  it("leaves invariable weekdays unchanged (lunes…viernes)", () => {
    expect(typicalAverageLabel(0, 5)).toBe("Media de 5 lunes");
    expect(typicalAverageLabel(2, 4)).toBe("Media de 4 miércoles");
    expect(typicalAverageLabel(4, 2)).toBe("Media de 2 viernes");
  });

  it("falls back to a generic noun for an out-of-range index", () => {
    expect(typicalAverageLabel(99, 5)).toBe("Media de 5 días");
  });
});
