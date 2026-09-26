import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dayNumber, isoFromDay, isoWeekday, parseIso } from '../../../src/core/dates/civil.ts';
import { easterSunday } from '../../../src/core/dates/easter.ts';
import { holidaysInYear, LAENDER, type Land } from '../../../src/core/dates/holidays.ts';
import { countWorkdays } from '../../../src/core/dates/workdays.ts';

const ptb = JSON.parse(
  readFileSync(new URL('../../fixtures/ptb-ostertermine-1980-2031.json', import.meta.url), 'utf8'),
) as { ostersonntag: Record<string, string> };

const dates = (year: number, land: Land, regional: string[] = []) =>
  holidaysInYear(year, land, new Set(regional)).map((h) => h.date);
const has = (year: number, land: Land, date: string, regional: string[] = []) =>
  dates(year, land, regional).includes(date);

describe('Tage (civil)', () => {
  it('rechnet Wochentage und lehnt ungültige Daten ab', () => {
    expect(isoWeekday(dayNumber(2026, 9, 26))).toBe(6);
    expect(isoWeekday(dayNumber(1970, 1, 1))).toBe(4);
    expect(parseIso('2026-02-30')).toBeNull();
    expect(parseIso('2024-02-29')).toBe(dayNumber(2024, 2, 29));
    expect(isoFromDay(dayNumber(2026, 12, 31))).toBe('2026-12-31');
  });
});

describe('Ostersonntag nach der Formel der PTB', () => {
  it('stimmt mit der Osterfesttabelle der PTB 1980 bis 2031 überein', () => {
    const entries = Object.entries(ptb.ostersonntag);
    expect(entries).toHaveLength(52);
    for (const [year, date] of entries)
      expect(isoFromDay(easterSunday(Number(year))), year).toBe(date);
  });
});

describe('Feiertage je Land (Wortlaut in docs/feiertage-recht.md)', () => {
  it('Anzahl der landesweiten Feiertage 2026 je Land', () => {
    const expected: Record<Land, number> = {
      BW: 12,
      BY: 12,
      BE: 10,
      BB: 12,
      HB: 10,
      HH: 10,
      HE: 10,
      MV: 11,
      NI: 10,
      NW: 11,
      RP: 11,
      SL: 12,
      SN: 11,
      ST: 11,
      SH: 10,
      TH: 11,
    };
    for (const { code } of LAENDER) expect(dates(2026, code), code).toHaveLength(expected[code]);
  });

  it('bewegliche Feiertage 2026 (Ostern 5. April)', () => {
    expect(dates(2026, 'NW')).toEqual([
      '2026-01-01',
      '2026-04-03',
      '2026-04-06',
      '2026-05-01',
      '2026-05-14',
      '2026-05-25',
      '2026-06-04',
      '2026-10-03',
      '2026-11-01',
      '2026-12-25',
      '2026-12-26',
    ]);
    expect(has(2026, 'BB', '2026-04-05')).toBe(true);
    expect(has(2026, 'BB', '2026-05-24')).toBe(true);
  });

  it('Tag der Deutschen Einheit auch in Baden-Württemberg (Einigungsvertrag)', () => {
    expect(has(2026, 'BW', '2026-10-03')).toBe(true);
  });

  it('Reformationstag im Norden ab 2018, nie in Baden-Württemberg', () => {
    for (const land of ['HB', 'HH', 'NI', 'SH'] as const)
      expect(has(2018, land, '2018-10-31'), land).toBe(true);
    expect(has(2018, 'BB', '2018-10-31')).toBe(true);
    expect(has(2026, 'BW', '2026-10-31')).toBe(false);
  });

  it('Berlin: Frauentag ab 2019, einmalige Feiertage 2020, 2025 und 2028', () => {
    expect(has(2018, 'BE', '2018-03-08')).toBe(false);
    expect(has(2019, 'BE', '2019-03-08')).toBe(true);
    expect(has(2020, 'BE', '2020-05-08')).toBe(true);
    expect(has(2021, 'BE', '2021-05-08')).toBe(false);
    expect(has(2025, 'BE', '2025-05-08')).toBe(true);
    expect(has(2028, 'BE', '2028-06-17')).toBe(true);
    expect(has(2029, 'BE', '2029-06-17')).toBe(false);
    expect(has(2025, 'BB', '2025-05-08')).toBe(false);
  });

  it('Mecklenburg-Vorpommern: Frauentag ab 2023; Thüringen: Weltkindertag ab 2019', () => {
    expect(has(2022, 'MV', '2022-03-08')).toBe(false);
    expect(has(2023, 'MV', '2023-03-08')).toBe(true);
    expect(has(2018, 'TH', '2018-09-20')).toBe(false);
    expect(has(2019, 'TH', '2019-09-20')).toBe(true);
  });

  it('Buß- und Bettag in Sachsen: Mittwoch vor dem letzten Sonntag des Kirchenjahres', () => {
    const bb = (y: number) => holidaysInYear(y, 'SN').find((h) => h.id === 'buss-und-bettag')?.date;
    expect([bb(2018), bb(2022), bb(2023), bb(2026)]).toEqual([
      '2018-11-21',
      '2022-11-16',
      '2023-11-22',
      '2026-11-18',
    ]);
    for (let y = 2018; y <= 2035; y++) {
      const n = parseIso(bb(y) ?? '') ?? 0;
      expect(isoWeekday(n)).toBe(3);
      expect(Number(isoFromDay(n).slice(8))).toBeGreaterThanOrEqual(16);
      expect(Number(isoFromDay(n).slice(8))).toBeLessThanOrEqual(22);
    }
  });

  it('regionale Feiertage nur als gewählter Zusatz', () => {
    expect(has(2026, 'BY', '2026-08-15')).toBe(false);
    expect(has(2026, 'BY', '2026-08-15', ['mariae-himmelfahrt'])).toBe(true);
    expect(has(2026, 'BY', '2026-08-08', ['friedensfest'])).toBe(true);
    expect(has(2026, 'SN', '2026-06-04')).toBe(false);
    expect(has(2026, 'SN', '2026-06-04', ['fronleichnam'])).toBe(true);
    expect(has(2026, 'TH', '2026-06-04', ['fronleichnam'])).toBe(true);
    // Im Saarland landesweit, ohne Zusatz
    expect(has(2026, 'SL', '2026-08-15')).toBe(true);
    // Ein Zusatz aus einem anderen Land wirkt nicht
    expect(has(2026, 'NI', '2026-08-15', ['mariae-himmelfahrt'])).toBe(false);
  });
});

describe('countWorkdays', () => {
  const none = new Set<string>();

  it('Januar 2026 in Bayern und Niedersachsen', () => {
    const by = countWorkdays('2026-01-01', '2026-01-31', {
      land: 'BY',
      saturday: false,
      regional: none,
    });
    expect(by).toMatchObject({ ok: true, calendarDays: 31, workdays: 20, restDays: 9 });
    const ni = countWorkdays('2026-01-01', '2026-01-31', {
      land: 'NI',
      saturday: false,
      regional: none,
    });
    expect(ni).toMatchObject({ ok: true, workdays: 21 });
  });

  it('ganzes Jahr 2026 in NRW, Montag bis Freitag und Montag bis Samstag', () => {
    const week = countWorkdays('2026-01-01', '2026-12-31', {
      land: 'NW',
      saturday: false,
      regional: none,
    });
    expect(week).toMatchObject({ ok: true, calendarDays: 365, workdays: 253, restDays: 104 });
    if (week.ok) {
      expect(week.holidays.filter((h) => !h.counted).map((h) => h.day)).toEqual([
        dayNumber(2026, 10, 3),
        dayNumber(2026, 11, 1),
        dayNumber(2026, 12, 26),
      ]);
    }
    const sat = countWorkdays('2026-01-01', '2026-12-31', {
      land: 'NW',
      saturday: true,
      regional: none,
    });
    expect(sat).toMatchObject({ ok: true, workdays: 303, restDays: 52 });
  });

  it('Anfang und Ende zählen mit; Jahreswechsel', () => {
    expect(
      countWorkdays('2026-09-28', '2026-09-28', { land: 'HE', saturday: false, regional: none }),
    ).toMatchObject({ workdays: 1 });
    expect(
      countWorkdays('2025-12-24', '2026-01-02', { land: 'HE', saturday: false, regional: none }),
    ).toMatchObject({ calendarDays: 10, workdays: 5 });
  });

  it('meldet Fehler statt zu raten', () => {
    const o = { land: 'BE' as const, saturday: false, regional: none };
    expect(countWorkdays('2026-02-30', '2026-03-01', o)).toEqual({ ok: false, code: 'invalid' });
    expect(countWorkdays('2026-03-02', '2026-03-01', o)).toEqual({ ok: false, code: 'order' });
    expect(countWorkdays('2017-12-01', '2018-01-10', o)).toEqual({ ok: false, code: 'range' });
    expect(countWorkdays('2035-12-01', '2036-01-10', o)).toEqual({ ok: false, code: 'range' });
  });
});
