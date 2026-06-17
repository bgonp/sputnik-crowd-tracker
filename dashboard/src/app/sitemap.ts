import type { MetadataRoute } from "next";
import { getCachedVenues } from "@/lib/cached-queries";
import { getSiteUrl } from "@/lib/site";
import { venueSlug } from "@/lib/venues";

// Render at request time rather than prerendering at build. The venue list
// comes from the DB, and the build runs without one (CI uses an empty `file:`
// DB) — same reason the page route is dynamic. The venue query is still cached
// (`getCachedVenues`, 1h), so this stays cheap on Turso.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  // Degrade gracefully to a home-only sitemap if the venue list can't be
  // fetched (e.g. Turso briefly unavailable) rather than 500-ing the route.
  let venues: Awaited<ReturnType<typeof getCachedVenues>> = [];
  try {
    venues = await getCachedVenues();
  } catch {
    venues = [];
  }

  // The bare domain renders the all-venues overview (the homepage), so it leads
  // the sitemap at top priority; each venue page follows at 0.8.
  //
  // No `lastModified`: this route renders per request, so a `new Date()` here
  // would churn the timestamp on every fetch and signal false updates to
  // crawlers. The set of URLs is what matters; `changeFrequency` covers freshness.
  return [
    { url: base, changeFrequency: "hourly", priority: 1 },
    ...venues.map((v) => ({
      url: `${base}/${venueSlug(v.name)}`,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
  ];
}
