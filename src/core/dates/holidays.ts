/**
 * Gesetzliche Feiertage je Land (plan-phase2.md Werkzeug 29, E12). Grundlage sind allein die
 * Feiertagsgesetze der 16 Länder und Art. 2 Abs. 2 Einigungsvertrag im Wortlaut, mit den Fassungen
 * seit 2018: docs/feiertage-recht.md. Stand 26.09.2026.
 *
 * `from`/`until`: Beginn und Ende der Fassung, die den Feiertag aufführt. Ein Feiertag zählt, wenn
 * sein Datum in diesem Zeitraum liegt. Regionale Feiertage sind nie automatisch dabei, nur als
 * Zusatz, den der Nutzer wählt.
 */

import { dayNumber, type IsoDate, isoFromDay, isoWeekday, parseIso, yearOf } from './civil.ts';
import { easterSunday } from './easter.ts';

export const FIRST_YEAR = 2018;
export const LAST_YEAR = 2035;
/** Abrufdatum der Gesetzestexte */
export const LAW_STATE = '26.09.2026';

export type Land =
  | 'BW'
  | 'BY'
  | 'BE'
  | 'BB'
  | 'HB'
  | 'HH'
  | 'HE'
  | 'MV'
  | 'NI'
  | 'NW'
  | 'RP'
  | 'SL'
  | 'SN'
  | 'ST'
  | 'SH'
  | 'TH';

export const LAENDER: readonly { code: Land; name: string }[] = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
];

type Rule =
  | { kind: 'fixed'; month: number; day: number }
  | { kind: 'easter'; offset: number }
  | { kind: 'repentance' }
  | { kind: 'once'; date: IsoDate };

interface HolidayDef {
  id: string;
  name: string;
  rule: Rule;
  lands: readonly Land[] | 'all';
  from?: IsoDate;
  until?: IsoDate;
  /** Nur in Teilen des Landes, als abwählbarer Zusatz */
  regional?: true;
}

const fixed = (month: number, day: number): Rule => ({ kind: 'fixed', month, day });
const easter = (offset: number): Rule => ({ kind: 'easter', offset });

/** Reihenfolge = Reihenfolge im Kalender */
const HOLIDAYS: readonly HolidayDef[] = [
  { id: 'neujahr', name: 'Neujahr', rule: fixed(1, 1), lands: 'all' },
  {
    id: 'heilige-drei-koenige',
    name: 'Heilige Drei Könige',
    rule: fixed(1, 6),
    lands: ['BW', 'BY', 'ST'],
  },
  { id: 'frauentag', name: 'Frauentag', rule: fixed(3, 8), lands: ['BE'], from: '2019-02-07' },
  { id: 'frauentag', name: 'Frauentag', rule: fixed(3, 8), lands: ['MV'], from: '2022-07-13' },
  { id: 'karfreitag', name: 'Karfreitag', rule: easter(-2), lands: 'all' },
  { id: 'ostersonntag', name: 'Ostersonntag', rule: easter(0), lands: ['BB'] },
  { id: 'ostermontag', name: 'Ostermontag', rule: easter(1), lands: 'all' },
  { id: 'erster-mai', name: '1. Mai', rule: fixed(5, 1), lands: 'all' },
  {
    id: 'befreiung-2020',
    name: '75. Jahrestag der Befreiung vom Nationalsozialismus',
    rule: { kind: 'once', date: '2020-05-08' },
    lands: ['BE'],
  },
  {
    id: 'befreiung-2025',
    name: '80. Jahrestag der Befreiung vom Nationalsozialismus',
    rule: { kind: 'once', date: '2025-05-08' },
    lands: ['BE'],
  },
  { id: 'himmelfahrt', name: 'Christi Himmelfahrt', rule: easter(39), lands: 'all' },
  { id: 'pfingstsonntag', name: 'Pfingstsonntag', rule: easter(49), lands: ['BB'] },
  { id: 'pfingstmontag', name: 'Pfingstmontag', rule: easter(50), lands: 'all' },
  {
    id: 'fronleichnam',
    name: 'Fronleichnam',
    rule: easter(60),
    lands: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'],
  },
  {
    id: 'fronleichnam',
    name: 'Fronleichnam',
    rule: easter(60),
    lands: ['SN', 'TH'],
    regional: true,
  },
  {
    id: 'aufstand-2028',
    name: '75. Jahrestag des Aufstandes vom 17. Juni 1953',
    rule: { kind: 'once', date: '2028-06-17' },
    lands: ['BE'],
  },
  {
    id: 'friedensfest',
    name: 'Augsburger Friedensfest',
    rule: fixed(8, 8),
    lands: ['BY'],
    regional: true,
  },
  { id: 'mariae-himmelfahrt', name: 'Mariä Himmelfahrt', rule: fixed(8, 15), lands: ['SL'] },
  {
    id: 'mariae-himmelfahrt',
    name: 'Mariä Himmelfahrt',
    rule: fixed(8, 15),
    lands: ['BY'],
    regional: true,
  },
  {
    id: 'weltkindertag',
    name: 'Weltkindertag',
    rule: fixed(9, 20),
    lands: ['TH'],
    from: '2019-03-27',
  },
  { id: 'einheit', name: 'Tag der Deutschen Einheit', rule: fixed(10, 3), lands: 'all' },
  {
    id: 'reformationstag',
    name: 'Reformationstag',
    rule: fixed(10, 31),
    lands: ['BB', 'MV', 'SN', 'ST', 'TH'],
  },
  {
    id: 'reformationstag',
    name: 'Reformationstag',
    rule: fixed(10, 31),
    lands: ['HH'],
    from: '2018-03-21',
  },
  {
    id: 'reformationstag',
    name: 'Reformationstag',
    rule: fixed(10, 31),
    lands: ['SH'],
    from: '2018-03-30',
  },
  {
    id: 'reformationstag',
    name: 'Reformationstag',
    rule: fixed(10, 31),
    lands: ['HB', 'NI'],
    from: '2018-06-29',
  },
  {
    id: 'allerheiligen',
    name: 'Allerheiligen',
    rule: fixed(11, 1),
    lands: ['BW', 'BY', 'NW', 'RP', 'SL'],
  },
  { id: 'buss-und-bettag', name: 'Buß- und Bettag', rule: { kind: 'repentance' }, lands: ['SN'] },
  { id: 'weihnachten-1', name: '1. Weihnachtstag', rule: fixed(12, 25), lands: 'all' },
  { id: 'weihnachten-2', name: '2. Weihnachtstag', rule: fixed(12, 26), lands: 'all' },
];

/** Regionale Zusätze je Land, mit Erklärung für die Oberfläche */
export interface RegionalOption {
  id: string;
  name: string;
  where: string;
}

export const REGIONAL: Readonly<Partial<Record<Land, readonly RegionalOption[]>>> = {
  BY: [
    {
      id: 'mariae-himmelfahrt',
      name: 'Mariä Himmelfahrt (15. August)',
      where:
        'Gesetzlicher Feiertag in Gemeinden mit überwiegend katholischer Bevölkerung (Art. 1 Abs. 1 Nr. 2 und Abs. 3 FTG). Ob das für deine Gemeinde gilt, macht die Gemeinde bekannt.',
    },
    {
      id: 'friedensfest',
      name: 'Augsburger Friedensfest (8. August)',
      where: 'Gesetzlicher Feiertag nur in der Stadt Augsburg (Art. 1 Abs. 2 FTG).',
    },
  ],
  SN: [
    {
      id: 'fronleichnam',
      name: 'Fronleichnam',
      where:
        'Gesetzlicher Feiertag nur in den Regionen, die das Staatsministerium des Innern durch Rechtsverordnung bestimmt (§ 1 Abs. 1 SächsSFG).',
    },
  ],
  TH: [
    {
      id: 'fronleichnam',
      name: 'Fronleichnam',
      where:
        'Gesetzlicher Feiertag nur in Gemeinden mit überwiegend katholischer Wohnbevölkerung, die das zuständige Ministerium durch Rechtsverordnung festlegt (§ 2 Abs. 2 ThürFGtG).',
    },
  ],
};

/** Buß- und Bettag: Mittwoch vor dem letzten Sonntag des Kirchenjahres (16. bis 22. November) */
function repentanceDay(year: number): number {
  const christmas = dayNumber(year, 12, 25);
  // Letzter Sonntag vor dem 25. Dezember (4. Advent); 1. Advent drei Wochen davor
  const fourthAdvent = christmas - isoWeekday(christmas);
  const lastSundayOfChurchYear = fourthAdvent - 21 - 7;
  return lastSundayOfChurchYear - 4;
}

function dateOf(rule: Rule, year: number): number | null {
  switch (rule.kind) {
    case 'fixed':
      return dayNumber(year, rule.month, rule.day);
    case 'easter':
      return easterSunday(year) + rule.offset;
    case 'repentance':
      return repentanceDay(year);
    case 'once': {
      const n = parseIso(rule.date);
      return n !== null && yearOf(n) === year ? n : null;
    }
  }
}

export interface Holiday {
  /** Tagesnummer (core/dates/civil.ts) */
  day: number;
  date: IsoDate;
  id: string;
  name: string;
  regional: boolean;
}

/**
 * Gesetzliche Feiertage eines Landes in einem Jahr, nach Datum sortiert. Regionale nur, wenn ihre
 * id in `regional` steht.
 */
export function holidaysInYear(
  year: number,
  land: Land,
  regional: ReadonlySet<string> = new Set(),
): Holiday[] {
  const result: Holiday[] = [];
  for (const def of HOLIDAYS) {
    if (def.lands !== 'all' && !def.lands.includes(land)) continue;
    if (def.regional && !regional.has(def.id)) continue;
    const day = dateOf(def.rule, year);
    if (day === null) continue;
    const from = def.from ? parseIso(def.from) : null;
    const until = def.until ? parseIso(def.until) : null;
    if (from !== null && day < from) continue;
    if (until !== null && day > until) continue;
    result.push({
      day,
      date: isoFromDay(day),
      id: def.id,
      name: def.name,
      regional: def.regional === true,
    });
  }
  return result.sort((a, b) => a.day - b.day);
}
