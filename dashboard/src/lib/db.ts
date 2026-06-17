import { createClient } from "@libsql/client";
import { copyFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { basename, isAbsolute, join, resolve } from "path";

const url = process.env.TURSO_URL;
if (!url) {
  throw new Error("TURSO_URL is not set");
}

// Local URLs (file:, :memory:) ignore the token, so a missing one is fine there.
// Remote URLs need a real token — fail fast with an actionable message rather
// than passing "" and surfacing a confusing 401 on the first query.
const isLocal = url.startsWith("file:") || url.startsWith(":memory:");
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!isLocal && !authToken) {
  throw new Error(`TURSO_AUTH_TOKEN is required for a remote database URL (${url.split(":")[0]}://…)`);
}

export const db = createClient({ url: resolveLocalFileUrl(url), authToken });

// Normalize a `file:` URL to an absolute path, and on Vercel serve it from a
// writable copy. Used by the preview deployments, which point TURSO_URL at the
// committed `preview.db` fixture (see next.config.ts) instead of hitting Turso.
//   1. Relative paths (`file:preview.db`, `file:../dev.db`) are resolved against
//      the working directory — on serverless the CWD isn't guaranteed, so pin it
//      or the fixture is silently not found and every query returns empty.
//   2. On Vercel the deployment bundle is a read-only filesystem, but libsql
//      opens the file read-write; copy the fixture into the writable /tmp once
//      per cold start so the open succeeds.
function resolveLocalFileUrl(raw: string): string {
  if (!raw.startsWith("file:")) return raw;
  const path = raw.slice("file:".length);
  // Leave `file://`/`file:///` (already absolute URL forms) and absolute paths as-is.
  if (path.startsWith("//") || isAbsolute(path)) return raw;

  const absolute = resolve(process.cwd(), path);
  if (!process.env.VERCEL) return `file:${absolute}`;

  const writable = join(tmpdir(), basename(absolute));
  if (!existsSync(writable)) copyFileSync(absolute, writable);
  return `file:${writable}`;
}
