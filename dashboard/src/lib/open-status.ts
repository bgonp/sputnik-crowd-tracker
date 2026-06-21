import type { VenueHours } from "./queries";

/** A moment in Madrid local time. dow: 0 = Sunday … 6 = Saturday. */
export interface MadridMoment {
  dow: number;
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
 * Current Madrid wall-clock day-of-week + minute-of-day, DST-aware via the IANA
 * `Europe/Madrid` zone. Mirrors the scraper's `madridMoment` so the dashboard's
 * "open now?" decision matches what the scraper used to gate collection.
 */
export function madridMoment(now = new Date()): MadridMoment {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";

  const dow = WEEKDAY_TO_DOW[get("weekday")] ?? 0;
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some ICU builds emit "24" for midnight
  const minute = Number(get("minute"));
  return { dow, minuteOfDay: hour * 60 + minute };
}

/** Format minutes-from-midnight as "HH:MM". */
export function formatMinute(minuteOfDay: number): string {
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const mm = String(minuteOfDay % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * The venue's configured open window for a given day-of-week (0 = Sunday … 6 =
 * Saturday), or `null` when the table has no row for it — in which case callers
 * skip cropping (fail-safe, matching `openStatusFor`'s "no rows ⇒ open").
 */
export function openWindowFor(
  hours: VenueHours[],
  venueId: number,
  dow: number
): { openMin: number; closeMin: number } | null {
  const row = hours.find((h) => h.venueId === venueId && h.dow === dow);
  return row ? { openMin: row.openMin, closeMin: row.closeMin } : null;
}

export interface OpenStatus {
  open: boolean;
  /** "HH:MM" of the venue's next opening, when currently closed and one is known. */
  opensAt?: string;
}

/**
 * Whether a venue is open at `moment`, and when it next opens if not. A venue
 * with no rows in `hours` is treated as **open** — same fail-safe as the scraper,
 * and what keeps every venue showing live data when the table isn't populated
 * yet (e.g. before `sync-venues` runs).
 */
export function openStatusFor(hours: VenueHours[], venueId: number, moment: MadridMoment): OpenStatus {
  const venueRows = hours.filter((h) => h.venueId === venueId);
  if (venueRows.length === 0) return { open: true };

  const today = venueRows.find((h) => h.dow === moment.dow);
  if (today && moment.minuteOfDay >= today.openMin && moment.minuteOfDay < today.closeMin) {
    return { open: true };
  }

  // Closed: report the next opening — later today if we haven't reached it,
  // otherwise the first open day that follows.
  if (today && moment.minuteOfDay < today.openMin) {
    return { open: false, opensAt: formatMinute(today.openMin) };
  }
  for (let i = 1; i <= 7; i++) {
    const next = venueRows.find((h) => h.dow === (moment.dow + i) % 7);
    if (next) return { open: false, opensAt: formatMinute(next.openMin) };
  }
  return { open: false };
}
