import { describe, expect, it } from 'vitest';
import {
  convertColumns,
  excelSerial,
  formatNumber,
  formatValue,
  formatWallClock,
  parseCellText,
  wallClockFromDate,
  type WallClock,
} from '../../../src/core/sheet/values.ts';

const w = (year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0) =>
  ({ year, month, day, hours, minutes, seconds }) satisfies WallClock;

describe('wallClockFromDate', () => {
  it('liest die UTC-Felder und rundet auf ganze Sekunden', () => {
    expect(wallClockFromDate(new Date('2026-09-25T12:00:00.000Z'))).toEqual(w(2026, 9, 25, 12));
    expect(wallClockFromDate(new Date('2023-03-15T23:59:58.963Z'))).toEqual(
      w(2023, 3, 15, 23, 59, 59),
    );
    expect(wallClockFromDate(new Date('2023-03-15T23:59:59.600Z'))).toEqual(w(2023, 3, 16));
  });
});

describe('formatWallClock', () => {
  it.each([
    [w(2026, 9, 25), '25.09.2026'],
    [w(2026, 9, 5, 14, 30), '05.09.2026 14:30'],
    [w(2026, 1, 1, 8, 0, 5), '01.01.2026 08:00:05'],
    [w(1899, 12, 31, 12), '12:00'],
    [w(1899, 12, 30, 7, 45, 30), '07:45:30'],
  ])('%o → %s', (value, text) => {
    expect(formatWallClock(value)).toBe(text);
  });
});

describe('formatNumber', () => {
  it.each([
    [1234.5, ',', '1234,5'],
    [1234.5, '.', '1234.5'],
    [-0.1, ',', '-0,1'],
    [0.1 + 0.2, ',', '0,3'],
    [42, ',', '42'],
    [1e21, '.', '1E+21'],
    [1e-7, ',', '1E-7'],
    [123456789012345680, '.', '123456789012346000'],
  ] as const)('%d mit %s → %s', (value, decimal, text) => {
    expect(formatNumber(value, decimal)).toBe(text);
  });

  it('gibt für NaN und Unendlich nichts aus', () => {
    expect(formatNumber(Number.NaN, ',')).toBe('');
    expect(formatNumber(Infinity, ',')).toBe('');
  });
});

describe('formatValue', () => {
  it('schreibt leer, Text, Wahrheitswerte und Datum', () => {
    expect(formatValue(null, ',')).toBe('');
    expect(formatValue('Straße', ',')).toBe('Straße');
    expect(formatValue(true, ',')).toBe('WAHR');
    expect(formatValue(false, ',')).toBe('FALSCH');
    expect(formatValue(w(2026, 9, 25), '.')).toBe('25.09.2026');
  });
});

describe('excelSerial', () => {
  it('rechnet wie Excel (1900er Datumssystem)', () => {
    expect(excelSerial(w(2026, 9, 25))).toBe(46290);
    expect(excelSerial(w(2026, 9, 25, 12))).toBe(46290.5);
    expect(excelSerial(w(1900, 3, 1))).toBe(61);
  });

  it('liefert vor dem 1.3.1900 nichts (Schaltjahrfehler von Excel)', () => {
    expect(excelSerial(w(1900, 2, 28))).toBeNull();
    expect(excelSerial(w(1899, 12, 31, 12))).toBeNull();
  });
});

describe('parseCellText (CSV → Excel)', () => {
  it.each([
    ['12,50', ',', 12.5],
    ['1.234,56', ',', 1234.56],
    ['-1.234', ',', -1234],
    ['0,5', ',', 0.5],
    ['1234', ',', 1234],
    [' 42 ', ',', 42],
    ['12.50', '.', 12.5],
    ['1,234.56', '.', 1234.56],
    ['999999999999999', ',', 999999999999999],
  ] as const)('%s mit Dezimalzeichen %s → Zahl %d', (text, decimal, value) => {
    expect(parseCellText(text, decimal)).toBe(value);
  });

  it.each([
    ['01067', ','],
    ['007', ','],
    ['1234567890123456', ','],
    ['12,5 €', ','],
    ['19 %', ','],
    ['1.23', ','],
    ['12,50', '.'],
    ['1.234,5', '.'],
    ['+49 30 1234', ','],
    ['DE15 8765 4321 0000 2020 51', ','],
    ['12,34,56', ','],
    ['', ','],
    ['Anna', ','],
  ] as const)('„%s“ mit %s bleibt Text', (text, decimal) => {
    expect(parseCellText(text, decimal)).toBe(text);
  });

  it('erkennt deutsche und ISO-Datumsangaben, auch mit Uhrzeit', () => {
    expect(parseCellText('25.09.2026', ',')).toEqual(w(2026, 9, 25));
    expect(parseCellText('5.9.2026', ',')).toEqual(w(2026, 9, 5));
    expect(parseCellText('25.09.2026 14:30', ',')).toEqual(w(2026, 9, 25, 14, 30));
    expect(parseCellText('2026-09-25', '.')).toEqual(w(2026, 9, 25));
    expect(parseCellText('2026-09-25T08:15:30', ',')).toEqual(w(2026, 9, 25, 8, 15, 30));
  });

  it('lässt ungültige Daten und Daten vor März 1900 als Text', () => {
    for (const text of ['31.02.2026', '29.02.2025', '25.13.2026', '25.09.2026 24:00', '01.01.1900'])
      expect(parseCellText(text, ',')).toBe(text);
    expect(parseCellText('29.02.2024', ',')).toEqual(w(2024, 2, 29));
  });
});

describe('convertColumns (spaltenweise)', () => {
  const rows = [
    ['Name', 'Betrag', 'Datum', 'PLZ', 'Gemischt', 'Leer'],
    ['Anna', '12,50', '25.09.2026', '01067', '12', ''],
    ['Ben', '1.234', '', '80331', '25.09.2026', ''],
    ['Cem', '', '01.10.2026', '10115', '', ''],
  ];

  it('wandelt nur Spalten um, deren Werte ab Zeile 2 alle von derselben Art sind', () => {
    const { rows: out, numbers, dates } = convertColumns(rows, ',');
    expect(out[0]).toEqual(rows[0]);
    expect(out.map((r) => r[1])).toEqual(['Betrag', 12.5, 1234, '']);
    expect(out.map((r) => r[2])).toEqual(['Datum', w(2026, 9, 25), '', w(2026, 10, 1)]);
    expect(out.map((r) => r[3])).toEqual(['PLZ', '01067', '80331', '10115']);
    expect(out.map((r) => r[4])).toEqual(['Gemischt', '12', '25.09.2026', '']);
    expect(out.map((r) => r[5])).toEqual(['Leer', '', '', '']);
    expect({ numbers, dates }).toEqual({ numbers: 2, dates: 2 });
  });

  it('wandelt auch die erste Zeile um, wenn sie zur Spalte passt (Liste ohne Überschriften)', () => {
    const { rows: out } = convertColumns(
      [
        ['1,5', 'x'],
        ['2', 'y'],
      ],
      ',',
    );
    expect(out).toEqual([
      [1.5, 'x'],
      [2, 'y'],
    ]);
  });
});
