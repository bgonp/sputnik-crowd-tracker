// Venue opening hours — maintained config, NOT scraped.
//
// The gym occupancy API exposes no opening-hours ("horarios") data (see
// ../API.md and the endpoint research), so these are hand-curated from the
// public site (sputnikclimbing.com/contacto) and must be re-verified if the
// gym changes its schedule. We collect occupancy only while a venue is open,
// which trims overnight writes and keeps the readings table smaller.
//
// Hours are the *rocódromo* (climbing area) hours — what occupancy measures —
// not the cantina/kitchen. Times are Madrid local. Holidays are NOT computed:
// Sunday hours stand in for public holidays, so a weekday holiday over-scrapes
// slightly (harmless — a few extra rows).

/** A daily open window, in minutes from local midnight. `[openMin, closeMin)`. */
export interface OpenWindow {
  openMin: number;
  closeMin: number;
}

/** Per-venue schedule. Weekday = Mon–Fri; Sunday also covers public holidays. */
interface VenueSchedule {
  weekday: OpenWindow;
  saturday: OpenWindow;
  sunday: OpenWindow;
}

/** Minutes-from-midnight helper, e.g. `hm(7)` = 07:00, `hm(22, 30)` = 22:30. */
function hm(hour: number, minute = 0): number {
  return hour * 60 + minute;
}

// Keyed by the normalized venue name (see `normalizeVenueName`), so this does
// not depend on the unconfirmed IdRecinto↔venue mapping.
const VENUE_SCHEDULES: Record<string, VenueSchedule> = {
  alcobendas: {
    weekday: { openMin: hm(7), closeMin: hm(23) },
    saturday: { openMin: hm(9), closeMin: hm(21) },
    sunday: { openMin: hm(9), closeMin: hm(21) },
  },
  "las rozas": {
    weekday: { openMin: hm(7), closeMin: hm(23) },
    saturday: { openMin: hm(9), closeMin: hm(22) },
    sunday: { openMin: hm(8), closeMin: hm(21) },
  },
  legazpi: {
    weekday: { openMin: hm(7), closeMin: hm(23) },
    saturday: { openMin: hm(9), closeMin: hm(22) },
    sunday: { openMin: hm(9), closeMin: hm(21) },
  },
  chamberi: {
    weekday: { openMin: hm(7), closeMin: hm(23) },
    saturday: { openMin: hm(9), closeMin: hm(22) },
    sunday: { openMin: hm(9), closeMin: hm(21) },
  },
  guindalera: {
    weekday: { openMin: hm(7), closeMin: hm(23) },
    saturday: { openMin: hm(9), closeMin: hm(22) },
    sunday: { openMin: hm(9), closeMin: hm(21) },
  },
  berango: {
    weekday: { openMin: hm(10), closeMin: hm(22) },
    saturday: { openMin: hm(10), closeMin: hm(21) },
    sunday: { openMin: hm(10), closeMin: hm(21) },
  },
};

/**
 * Normalize an API venue name (`Recinto`, e.g. "Chamberí Principal") to a
 * schedule key: drop the " Principal" suffix, strip accents, lowercase.
 * "Chamberí Principal" → "chamberi", "Las Rozas Principal" → "las rozas".
 */
export function normalizeVenueName(name: string): string {
  return name
    .replace(/\s*Principal$/i, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** dow: 0 = Sunday … 6 = Saturday (matches `Date.getUTCDay` and SQLite `%w`). */
function windowForDow(schedule: VenueSchedule, dow: number): OpenWindow {
  if (dow === 0) return schedule.sunday;
  if (dow === 6) return schedule.saturday;
  return schedule.weekday;
}

/** A moment expressed in Madrid local time: day-of-week and minute-of-day. */
export interface MadridMoment {
  dow: number; // 0 = Sunday … 6 = Saturday
  minuteOfDay: number; // 0–1439
}

const WEEKDAY_TO_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Convert an instant to Madrid wall-clock day-of-week and minute-of-day,
 * DST-aware via the IANA `Europe/Madrid` zone (no manual offset math).
 */
export function madridMoment(now: Date): MadridMoment {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  const dow = WEEKDAY_TO_DOW[get("weekday")] ?? 0;
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some ICU builds emit "24" for midnight
  const minute = Number(get("minute"));
  return { dow, minuteOfDay: hour * 60 + minute };
}

/**
 * Whether a specific venue is open at the given Madrid moment. Venues with no
 * configured schedule default to **open** (fail-safe: keep collecting rather
 * than silently dropping a venue we don't recognize).
 *
 * Note this fail-safe only applies once a venue has been fetched (the per-venue
 * insert filter). The global skip gate (`anyVenueOpenAt`) considers only known
 * venues, so a brand-new venue is still not discovered during a window where
 * every known venue is closed — it surfaces on the next cycle a known venue is
 * open. In practice the configured set already covers all venues the API returns.
 */
export function isVenueOpenAt(venueName: string, moment: MadridMoment): boolean {
  const schedule = VENUE_SCHEDULES[normalizeVenueName(venueName)];
  if (!schedule) return true;
  const window = windowForDow(schedule, moment.dow);
  return moment.minuteOfDay >= window.openMin && moment.minuteOfDay < window.closeMin;
}

/** Whether *any* known venue is open at the given Madrid moment. */
export function anyVenueOpenAt(moment: MadridMoment): boolean {
  return Object.values(VENUE_SCHEDULES).some((schedule) => {
    const window = windowForDow(schedule, moment.dow);
    return moment.minuteOfDay >= window.openMin && moment.minuteOfDay < window.closeMin;
  });
}

/**
 * The open window for a venue on a given day-of-week, or `undefined` if the
 * venue has no configured schedule. Exposed for the seed generator.
 */
export function windowForVenue(venueName: string, dow: number): OpenWindow | undefined {
  const schedule = VENUE_SCHEDULES[normalizeVenueName(venueName)];
  return schedule ? windowForDow(schedule, dow) : undefined;
}
