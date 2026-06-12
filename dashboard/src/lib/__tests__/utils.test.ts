import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("merges multiple class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("resolves conflicting Tailwind classes, keeping the last", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("filters out falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("handles conditional classes", () => {
    const active = true;
    expect(cn("base", active && "active")).toBe("base active");
    expect(cn("base", !active && "active")).toBe("base");
  });

  it("returns an empty string with no input", () => {
    expect(cn()).toBe("");
  });
});
