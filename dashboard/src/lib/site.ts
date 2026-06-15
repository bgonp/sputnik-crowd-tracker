/**
 * Public base URL of the dashboard, used for canonical links, Open Graph URLs,
 * the sitemap, and robots.txt.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — set this explicitly in production.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the stable production domain Vercel injects
 *      (used so previews still point canonical URLs at production).
 *   3. http://localhost:3000 — local dev fallback.
 *
 * Always returned without a trailing slash.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
