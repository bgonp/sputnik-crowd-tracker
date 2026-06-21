import { describe, it, expect } from "vitest";
import {
  DAY_LABELS,
  HOUR_LABELS,
  OPENING_HOUR,
  FULL_DAY_LABELS,
  MONTH_LABELS,
  lastWeekdaysLabel,
  dateLineLabel,
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

describe("MONTH_LABELS", () => {
  it("has 12 lowercase Spanish abbreviations, January-indexed", () => {
    expect(MONTH_LABELS).toHaveLength(12);
    expect(MONTH_LABELS[0]).toBe("ene");
    expect(MONTH_LABELS[5]).toBe("jun");
    expect(MONTH_LABELS[11]).toBe("dic");
  });
});

describe("dateLineLabel", () => {
  it("renders weekday + day + month for a date string", () => {
    expect(dateLineLabel("2026-06-20")).toBe("Sáb 20 jun"); // Saturday
    expect(dateLineLabel("2026-06-22")).toBe("Lun 22 jun"); // Monday
  });

  it("derives the weekday itself (no leading zero on the day)", () => {
    expect(dateLineLabel("2026-01-04")).toBe("Dom 4 ene"); // Sunday
  });
});

describe("lastWeekdaysLabel", () => {
  it("pluralises vowel-ending weekdays (sábado → sábados)", () => {
    expect(lastWeekdaysLabel(5)).toBe("Últimos sábados");
    expect(lastWeekdaysLabel(6)).toBe("Últimos domingos");
  });

  it("leaves invariable weekdays unchanged (lunes…viernes)", () => {
    expect(lastWeekdaysLabel(0)).toBe("Últimos lunes");
    expect(lastWeekdaysLabel(2)).toBe("Últimos miércoles");
    expect(lastWeekdaysLabel(4)).toBe("Últimos viernes");
  });

  it("never surfaces the number of weeks", () => {
    expect(lastWeekdaysLabel(5)).not.toMatch(/\d/);
  });

  it("falls back to a generic plural noun", () => {
    expect(lastWeekdaysLabel(99)).toBe("Últimos días");
  });
});
