import type { MetadataRoute } from "next";
import { getCachedVenues } from "@/lib/cached-queries";
import { getSiteUrl } from "@/lib/site";

// Render at request time rather than prerendering at build. The venue list
// comes from the DB, and the build runs without one (CI uses an empty `file:`
// DB) — same reason the page route is dynamic. The venue query is still cached
// (`getCachedVenues`, 1h), so this stays cheap on Turso.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const lastModified = new Date();

  // Degrade gracefully to a home-only sitemap if the venue list can't be
  // fetched (e.g. Turso briefly unavailable) rather than 500-ing the route.
  let venues: Awaited<ReturnType<typeof getCachedVenues>> = [];
  try {
    venues = await getCachedVenues();
  } catch {
    venues = [];
  }

  return [
    { url: base, lastModified, changeFrequency: "hourly", priority: 1 },
    ...venues.map((v) => ({
      url: `${base}/?venue=${v.id}`,
      lastModified,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
  ];
}
