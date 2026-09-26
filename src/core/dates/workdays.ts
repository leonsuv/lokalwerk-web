/**
 * Arbeitstage zwischen zwei Daten zählen (plan-phase2.md Werkzeug 29, E12: ohne BGB-Fristen).
 * Beide Tage zählen mit. Arbeitstage sind Montag bis Freitag oder, auf Wunsch, Montag bis
 * Samstag, jeweils ohne die gesetzlichen Feiertage des Landes (core/dates/holidays.ts).
 */

import { isoWeekday, parseIso, yearOf } from './civil.ts';
import { FIRST_YEAR, holidaysInYear, LAST_YEAR, type Land } from './holidays.ts';

export interface WorkdayOptions {
  land: Land;
  /** Samstag als Arbeitstag (Werktage Montag bis Samstag) */
  saturday: boolean;
  /** gewählte regionale Zusätze (ids aus REGIONAL) */
  regional: ReadonlySet<string>;
}

export interface HolidayInRange {
  day: number;
  names: string[];
  /** fällt auf einen Tag, der sonst Arbeitstag wäre */
  counted: boolean;
}

export type WorkdayResult =
  | {
      ok: true;
      calendarDays: number;
      workdays: number;
      /** Tage, die schon wegen des Wochentags keine Arbeitstage sind */
      restDays: number;
      holidays: HolidayInRange[];
    }
  | { ok: false; code: 'invalid' | 'order' | 'range' };

export function countWorkdays(start: string, end: string, options: WorkdayOptions): WorkdayResult {
  const from = parseIso(start);
  const to = parseIso(end);
  if (from === null || to === null) return { ok: false, code: 'invalid' };
  if (to < from) return { ok: false, code: 'order' };
  if (yearOf(from) < FIRST_YEAR || yearOf(to) > LAST_YEAR) return { ok: false, code: 'range' };

  const lastWorkday = options.saturday ? 6 : 5;
  const byDay = new Map<number, string[]>();
  for (let year = yearOf(from); year <= yearOf(to); year++) {
    for (const h of holidaysInYear(year, options.land, options.regional)) {
      if (h.day < from || h.day > to) continue;
      byDay.set(h.day, [...(byDay.get(h.day) ?? []), h.name]);
    }
  }

  let workdays = 0;
  let restDays = 0;
  for (let day = from; day <= to; day++) {
    if (isoWeekday(day) > lastWorkday) restDays++;
    else if (!byDay.has(day)) workdays++;
  }
  const holidays = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, names]) => ({ day, names, counted: isoWeekday(day) <= lastWorkday }));
  return { ok: true, calendarDays: to - from + 1, workdays, restDays, holidays };
}
