/**
 * Kalendertage ohne Uhrzeit und ohne Zeitzone: fortlaufende Tagesnummer (0 = 1. Januar 1970)
 * und Datum als „JJJJ-MM-TT“. Gerechnet wird über Date.UTC, damit Sommerzeit nichts verschiebt.
 */

export type IsoDate = string;

const DAY_MS = 86_400_000;

export function dayNumber(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function isoFromDay(n: number): IsoDate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Tagesnummer eines Datums „JJJJ-MM-TT“; null, wenn es das Datum nicht gibt */
export function parseIso(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const n = dayNumber(Number(m[1]), Number(m[2]), Number(m[3]));
  return isoFromDay(n) === text ? n : null;
}

/** Wochentag nach ISO 8601: 1 = Montag … 7 = Sonntag */
export function isoWeekday(n: number): number {
  // Der 1. Januar 1970 war ein Donnerstag (4)
  return ((((n + 3) % 7) + 7) % 7) + 1;
}

export const yearOf = (n: number): number => new Date(n * DAY_MS).getUTCFullYear();

/** „Mo, 26.09.2026“ */
export function formatGermanDate(n: number): string {
  const [y, m, d] = isoFromDay(n).split('-');
  return `${WEEKDAY_SHORT[isoWeekday(n) - 1] ?? ''}, ${d}.${m}.${y}`;
}

export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
