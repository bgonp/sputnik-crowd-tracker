import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/site", () => ({ getSiteUrl: () => "https://aforosputnik.com" }));

import robots from "../robots";

describe("robots", () => {
  it("allows all crawlers and points them at the sitemap + host", () => {
    const r = robots();
    expect(r.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(r.sitemap).toBe("https://aforosputnik.com/sitemap.xml");
    expect(r.host).toBe("https://aforosputnik.com");
  });
});
