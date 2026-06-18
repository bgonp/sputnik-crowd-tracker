import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@libsql/client", () => ({
  createClient: vi.fn((opts: unknown) => ({ __mockClient: true, opts })),
}));

import { createClient } from "@libsql/client";
import { createDbClient } from "../db";

const KEYS = ["TURSO_URL", "TURSO_AUTH_TOKEN"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  vi.mocked(createClient).mockClear();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("createDbClient", () => {
  it("throws when TURSO_URL is missing", () => {
    expect(() => createDbClient()).toThrow(/TURSO_URL is not set/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("throws when a remote URL has no auth token", () => {
    process.env.TURSO_URL = "libsql://db.turso.io";
    expect(() => createDbClient()).toThrow(/TURSO_AUTH_TOKEN is required/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("builds a client for a remote URL with a token", () => {
    process.env.TURSO_URL = "libsql://db.turso.io";
    process.env.TURSO_AUTH_TOKEN = "secret";
    createDbClient();
    expect(createClient).toHaveBeenCalledWith({
      url: "libsql://db.turso.io",
      authToken: "secret",
    });
  });

  it("allows a local file: URL with no token", () => {
    process.env.TURSO_URL = "file:../dev.db";
    expect(() => createDbClient()).not.toThrow();
    expect(createClient).toHaveBeenCalledWith({
      url: "file:../dev.db",
      authToken: "",
    });
  });

  it("allows a :memory: URL with no token", () => {
    process.env.TURSO_URL = ":memory:";
    createDbClient();
    expect(createClient).toHaveBeenCalledWith({ url: ":memory:", authToken: "" });
  });
});
