import { describe, expect, it } from 'vitest';
import {
  checkExecutionDate,
  MAX_DAYS_AHEAD,
  nextWorkday,
  toIsoDate,
} from '../../../src/core/sepa/dates.ts';

// Monate in JavaScript ab 0: new Date(2026, 8, 25) ist der 25.09.2026.
describe('nextWorkday (Ortszeit, plan.md S9)', () => {
  it.each([
    [new Date(2026, 8, 24, 10, 0), '2026-09-25', 'Donnerstag → Freitag'],
    [new Date(2026, 8, 25, 18, 0), '2026-09-28', 'Freitagabend → Montag'],
    [new Date(2026, 8, 25, 23, 30), '2026-09-28', 'Freitag 23:30 → Montag'],
    [new Date(2026, 8, 26, 12, 0), '2026-09-28', 'Samstag → Montag'],
    [new Date(2026, 8, 27, 12, 0), '2026-09-28', 'Sonntag → Montag'],
    [new Date(2026, 8, 24, 0, 30), '2026-09-25', 'kurz nach Mitternacht (Fehler im Prototyp: UTC)'],
    [new Date(2026, 11, 31, 12, 0), '2027-01-01', 'Jahreswechsel'],
  ])('%s → %s (%s)', (now, expected) => {
    expect(nextWorkday(now)).toBe(expected);
  });

  it('prüft keine Bankfeiertage (Anlage 3 S. 102: Bank verschiebt selbst)', () => {
    // 24.12.2026 ist ein Donnerstag, der 25.12. ein Feiertag, aber Freitag
    expect(nextWorkday(new Date(2026, 11, 24, 12, 0))).toBe('2026-12-25');
  });
});

describe('checkExecutionDate', () => {
  const now = new Date(2026, 8, 24, 21, 30);

  it('heute und die nächsten Tage sind in Ordnung', () => {
    expect(checkExecutionDate('2026-09-24', now)).toEqual({ ok: true, warning: null });
    expect(checkExecutionDate('2026-09-25', now)).toEqual({ ok: true, warning: null });
  });

  it('ein Datum in der Vergangenheit ist ein Fehler', () => {
    expect(checkExecutionDate('2026-09-23', now)).toEqual({ ok: false, code: 'past' });
  });

  it(`bis ${MAX_DAYS_AHEAD} Tage in der Zukunft keine Warnung, danach eine (Anlage 3 S. 102, plan.md O7)`, () => {
    expect(checkExecutionDate('2026-10-09', now)).toEqual({ ok: true, warning: null }); // +15
    expect(checkExecutionDate('2026-10-10', now)).toEqual({ ok: true, warning: 'far-future' }); // +16
  });

  it('rechnet über die Zeitumstellung richtig', () => {
    const beforeChange = new Date(2026, 9, 24, 23, 59); // Sa 24.10.2026, Umstellung am 25.10.
    expect(checkExecutionDate('2026-11-08', beforeChange)).toEqual({ ok: true, warning: null }); // +15
    expect(checkExecutionDate('2026-11-09', beforeChange)).toEqual({
      ok: true,
      warning: 'far-future',
    });
  });

  it.each([
    ['', 'empty'],
    ['2026-02-30', 'invalid'],
    ['2026-13-01', 'invalid'],
    ['25.09.2026', 'invalid'],
    ['2026-9-25', 'invalid'],
  ])('%j → %s', (date, code) => {
    expect(checkExecutionDate(date, now)).toEqual({ ok: false, code });
  });
});

describe('toIsoDate', () => {
  it('nutzt Ortszeit, nicht UTC', () => {
    expect(toIsoDate(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
  });
});
