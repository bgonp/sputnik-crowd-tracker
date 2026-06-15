import type { MetadataRoute } from "next";
import { getCachedVenues } from "@/lib/cached-queries";
import { getSiteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const lastModified = new Date();
  const venues = await getCachedVenues();

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
