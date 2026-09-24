/**
 * Ausführungsdatum (plan.md S9, O7). Rechnet mit Kalenderdaten „JJJJ-MM-TT“ in Ortszeit,
 * nicht in UTC (Fehler im Prototyp). Keine Prüfung von Bankfeiertagen: Laut Anlage 3 26.11,
 * S. 102, darf die Bank auf den nächsten TARGET-Geschäftstag verschieben.
 */

/** Banken müssen Aufträge nicht verarbeiten, die mehr als 15 Kalendertage vorher eingehen (S. 102). */
export const MAX_DAYS_AHEAD = 15;

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Nächster Werktag (Mo–Fr) nach heute, in Ortszeit. */
export function nextWorkday(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return toIsoDate(d);
}

/** Tage zwischen zwei Kalenderdaten, unabhängig von Sommerzeit. */
function daysBetween(from: string, to: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

function isCalendarDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d;
}

export type ExecutionDateResult =
  { ok: true; warning: 'far-future' | null } | { ok: false; code: 'empty' | 'invalid' | 'past' };

export function checkExecutionDate(date: string, now: Date): ExecutionDateResult {
  if (date.trim() === '') return { ok: false, code: 'empty' };
  if (!isCalendarDate(date)) return { ok: false, code: 'invalid' };
  const ahead = daysBetween(toIsoDate(now), date);
  if (ahead < 0) return { ok: false, code: 'past' };
  return { ok: true, warning: ahead > MAX_DAYS_AHEAD ? 'far-future' : null };
}
