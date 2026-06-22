// Pure helpers for the `app/[[...venue]]` route: interpreting query params and
// the legacy `?venue=<id>` scheme. Kept out of the page component so they can be
// unit-tested without rendering.

export type SearchParams = Record<string, string | string[] | undefined>;

// A param can arrive repeated, which Next surfaces as `string[]`; treat the
// unit as "absolute" when any of its values is, so behavior is deterministic.
export const isAbsoluteUnit = (value: string | string[] | undefined): boolean =>
  Array.isArray(value) ? value.includes("absolute") : value === "absolute";

// Carry the incoming query string through the canonicalization redirect so
// attribution params (utm_*, etc.) survive for analytics. Drop the legacy
// `venue` key (it's now encoded in the path) and collapse `unit` to a single
// `unit=absolute`, since percentage is the default and isn't worth carrying.
export function forwardedQuery(searchParams: SearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || key === "venue") continue;
    if (key === "unit") {
      if (isAbsoluteUnit(value)) params.set("unit", "absolute");
      continue;
    }
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// Build the href for the line chart's day selector: set `?date=<value>` on the
// current path, but drop the param entirely when the default day (today) is
// chosen so the canonical URL stays clean. Other params (utm_*, etc.) are kept.
export function dateChangeHref(
  pathname: string,
  current: URLSearchParams,
  value: string,
  defaultValue: string
): string {
  const params = new URLSearchParams(current);
  if (value === defaultValue) params.delete("date");
  else params.set("date", value);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

// Parse a legacy `?venue=` value into a venue id. Match only when the whole
// value is an integer (so "2abc" is rejected, not truncated to 2); pick the
// first when the param is repeated. Returns null when there's nothing usable.
export function parseLegacyVenueId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}
