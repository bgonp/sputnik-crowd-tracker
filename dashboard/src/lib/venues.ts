import type { Venue } from "./queries";

/** Drop the " Principal" suffix the gym API appends to every venue name. */
export function shortVenueName(name: string): string {
  return name.replace(/ Principal$/, "");
}

/**
 * URL slug for a venue: the short name, lowercased, with accents stripped and
 * any run of non-alphanumerics collapsed to a single hyphen.
 * e.g. "Las Rozas Principal" → "las-rozas", "Chamberí Principal" → "chamberi".
 */
export function venueSlug(name: string): string {
  return shortVenueName(name)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // strip the marks NFD split off the letters
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve a slug back to its venue, or `undefined` if none match. */
export function findVenueBySlug(
  venues: Venue[],
  slug: string
): Venue | undefined {
  return venues.find((v) => venueSlug(v.name) === slug);
}
