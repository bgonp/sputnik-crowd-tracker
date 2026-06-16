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

  // Degrade gracefully to an empty sitemap if the venue list can't be fetched
  // (e.g. Turso briefly unavailable) rather than 500-ing the route. We don't
  // emit the bare domain here: with no venues it either 308-redirects or 404s,
  // so listing it would advertise a non-canonical / broken URL to crawlers.
  let venues: Awaited<ReturnType<typeof getCachedVenues>> = [];
  try {
    venues = await getCachedVenues();
  } catch {
    venues = [];
  }

  // The bare domain 308-redirects to the first venue, so we list the venue
  // slug paths directly (the canonical URLs) rather than the redirecting root.
  // The first venue is the default landing, so it gets top priority.

  // No `lastModified`: this route renders per request, so a `new Date()` here
  // would churn the timestamp on every fetch and signal false updates to
  // crawlers. The set of URLs is what matters; `changeFrequency` covers freshness.
  return venues.map((v, i) => ({
    url: `${base}/${venueSlug(v.name)}`,
    changeFrequency: "hourly" as const,
    priority: i === 0 ? 1 : 0.8,
  }));
}
