import { describe, it, expect } from "vitest";
import {
  isAbsoluteUnit,
  forwardedQuery,
  parseLegacyVenueId,
  dateChangeHref,
} from "../venue-routing";

describe("isAbsoluteUnit", () => {
  it("is true only for the absolute value", () => {
    expect(isAbsoluteUnit("absolute")).toBe(true);
    expect(isAbsoluteUnit("percentage")).toBe(false);
    expect(isAbsoluteUnit(undefined)).toBe(false);
  });

  it("treats a repeated param as absolute if any value is", () => {
    expect(isAbsoluteUnit(["percentage", "absolute"])).toBe(true);
    expect(isAbsoluteUnit(["absolute"])).toBe(true);
    expect(isAbsoluteUnit(["percentage", "x"])).toBe(false);
    expect(isAbsoluteUnit([])).toBe(false);
  });
});

describe("forwardedQuery", () => {
  // Parse the result so assertions don't depend on param ordering.
  const params = (sp: Parameters<typeof forwardedQuery>[0]) =>
    new URLSearchParams(forwardedQuery(sp).replace(/^\?/, ""));

  it("is empty for no carryable params", () => {
    expect(forwardedQuery({})).toBe("");
    expect(forwardedQuery({ x: undefined })).toBe("");
  });

  it("drops the legacy venue key", () => {
    expect(forwardedQuery({ venue: "2" })).toBe("");
  });

  it("forwards attribution params like utm_*", () => {
    const p = params({ venue: "2", utm_source: "ig", utm_medium: "email" });
    expect(p.get("utm_source")).toBe("ig");
    expect(p.get("utm_medium")).toBe("email");
    expect(p.has("venue")).toBe(false);
  });

  it("keeps repeated non-unit params", () => {
    const p = params({ tag: ["a", "b"] });
    expect(p.getAll("tag")).toEqual(["a", "b"]);
  });

  it("carries unit only when absolute, collapsed to one", () => {
    expect(forwardedQuery({ unit: "absolute" })).toBe("?unit=absolute");
    expect(forwardedQuery({ unit: "percentage" })).toBe("");
    expect(forwardedQuery({ unit: "foo" })).toBe("");
    expect(forwardedQuery({ unit: ["percentage", "absolute"] })).toBe("?unit=absolute");
    expect(forwardedQuery({ unit: ["absolute", "absolute"] })).toBe("?unit=absolute");
  });
});

describe("parseLegacyVenueId", () => {
  it("parses a clean integer", () => {
    expect(parseLegacyVenueId("2")).toBe(2);
    expect(parseLegacyVenueId("42")).toBe(42);
  });

  it("rejects non-integers entirely (no prefix matching)", () => {
    expect(parseLegacyVenueId("2abc")).toBeNull();
    expect(parseLegacyVenueId("abc")).toBeNull();
    expect(parseLegacyVenueId(" 2")).toBeNull();
    expect(parseLegacyVenueId("")).toBeNull();
    expect(parseLegacyVenueId(undefined)).toBeNull();
  });

  it("takes the first value when the param is repeated", () => {
    expect(parseLegacyVenueId(["2", "3"])).toBe(2);
    expect(parseLegacyVenueId(["abc", "2"])).toBeNull();
  });
});

describe("dateChangeHref", () => {
  const today = "2026-06-20";

  it("drops the date param when the default (today) is chosen", () => {
    expect(dateChangeHref("/las-rozas", new URLSearchParams(), today, today)).toBe(
      "/las-rozas"
    );
  });

  it("sets ?date for a non-default day", () => {
    expect(
      dateChangeHref("/las-rozas", new URLSearchParams(), "2026-06-18", today)
    ).toBe("/las-rozas?date=2026-06-18");
  });

  it("preserves other params when setting the date", () => {
    expect(
      dateChangeHref("/las-rozas", new URLSearchParams("utm_source=x"), "2026-06-18", today)
    ).toBe("/las-rozas?utm_source=x&date=2026-06-18");
  });

  it("removes only the date param when returning to today", () => {
    expect(
      dateChangeHref(
        "/las-rozas",
        new URLSearchParams("date=2026-06-18&utm_source=x"),
        today,
        today
      )
    ).toBe("/las-rozas?utm_source=x");
  });

  it("does not mutate the passed-in params", () => {
    const params = new URLSearchParams("date=2026-06-18");
    dateChangeHref("/las-rozas", params, today, today);
    expect(params.get("date")).toBe("2026-06-18");
  });
});
