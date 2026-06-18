import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSiteUrl } from "../site";

const KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("getSiteUrl", () => {
  it("falls back to localhost when nothing is set", () => {
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("uses the explicit NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://aforosputnik.com";
    expect(getSiteUrl()).toBe("https://aforosputnik.com");
  });

  it("strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://aforosputnik.com///";
    expect(getSiteUrl()).toBe("https://aforosputnik.com");
  });

  it("adds https:// to a scheme-less value", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "aforosputnik.com";
    expect(getSiteUrl()).toBe("https://aforosputnik.com");
  });

  it("preserves an explicit http:// scheme", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:4000";
    expect(getSiteUrl()).toBe("http://localhost:4000");
  });

  it("falls back to the Vercel production URL when no explicit URL is set", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "my-app.vercel.app";
    expect(getSiteUrl()).toBe("https://my-app.vercel.app");
  });

  it("prefers the explicit URL over the Vercel one", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://aforosputnik.com";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "my-app.vercel.app";
    expect(getSiteUrl()).toBe("https://aforosputnik.com");
  });
});
