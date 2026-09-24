import { describe, expect, it } from 'vitest';
import { centsToXmlDecimal, MAX_CENTS, parseAmount } from '../../../src/core/sepa/amount.ts';

const ok = (cents: number) => ({ ok: true, cents });
const fail = (code: string) => ({ ok: false, code });
const nbsp = String.fromCodePoint(0xa0);
const narrowNbsp = String.fromCodePoint(0x202f);

describe('parseAmount: Formate aus AGENTS.md Abschnitt 5', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1,234.56', 123456],
    ['12.50', 1250],
    ['12,5', 1250],
    ['30', 3000],
    ['€ 1.234,56', 123456],
    ['1.234,56 €', 123456],
    ['1.234,56EUR', 123456],
    ['EUR 45,50', 4550],
    ['1 234,56', 123456],
    [`1${nbsp}234,56`, 123456],
    [`1${narrowNbsp}234,56`, 123456],
    ['1.234.567,89', 123456789],
    ['1,234,567.89', 123456789],
    ['1.234.567', 123456700],
    ['0,01', 1],
    ['0.5', 50],
    ['007,50', 750],
    ['  45,50  ', 4550],
  ])('%j → %d Cent', (text, cents) => {
    expect(parseAmount(text)).toEqual(ok(cents));
  });
});

describe('parseAmount: mehrdeutige Beträge (plan.md B1)', () => {
  it.each(['1,234', '1.234', '33,333', '12,345', '999.999'])('%j ist nicht eindeutig', (text) => {
    expect(parseAmount(text)).toEqual(fail('ambiguous'));
  });

  it('0,123 ist nicht mehrdeutig, sondern hat zu viele Nachkommastellen', () => {
    expect(parseAmount('0,123')).toEqual(fail('too-many-decimals'));
  });

  it.each(['1234,567', '1.234,567', '12.3456'])(
    '%j hat zu viele Nachkommastellen, wird nie gerundet',
    (text) => {
      expect(parseAmount(text)).toEqual(fail('too-many-decimals'));
    },
  );
});

describe('parseAmount: Fehler', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['€', 'empty'],
    ['-12,50', 'negative'],
    ['12,50-', 'negative'],
    ['zwölf', 'unreadable'],
    ['12,50 USD', 'unreadable'],
    ["1'234.50", 'unreadable'],
    ['1.23,45', 'unreadable'],
    ['12 50', 'unreadable'],
    ['12,', 'unreadable'],
    [',50', 'unreadable'],
    ['1,2,3', 'unreadable'],
    ['+12', 'unreadable'],
    ['0', 'zero'],
    ['0,00', 'zero'],
  ])('%j → %s', (text, code) => {
    expect(parseAmount(text)).toEqual(fail(code));
  });
});

describe('parseAmount: Grenzen (Anlage 3 S. 254, Rulebook AT-T002)', () => {
  it('999.999.999,99 ist der Höchstbetrag', () => {
    expect(parseAmount('999.999.999,99')).toEqual(ok(MAX_CENTS));
    expect(parseAmount(999999999.99)).toEqual(ok(MAX_CENTS));
  });

  it('1.000.000.000,00 ist zu hoch', () => {
    expect(parseAmount('1.000.000.000,00')).toEqual(fail('too-large'));
    expect(parseAmount('99999999999999999999')).toEqual(fail('too-large'));
    expect(parseAmount(1e9)).toEqual(fail('too-large'));
  });

  it('0,01 ist der Mindestbetrag', () => {
    expect(parseAmount('0,01')).toEqual(ok(1));
    expect(parseAmount(0.01)).toEqual(ok(1));
  });
});

describe('parseAmount: Zahlen aus Excel-Zellen', () => {
  it.each([
    [45.5, 4550],
    [30, 3000],
    [1234.56, 123456],
    [0.1 + 0.2, 30],
    [19.99 * 3, 5997],
  ])('%d → %d Cent (Gleitkomma-Rauschen ausgeglichen)', (value, cents) => {
    expect(parseAmount(value)).toEqual(ok(cents));
  });

  it.each([33.333, 1.005, 12.3456, 1 / 3])(
    '%d hat eine echte dritte Nachkommastelle: Fehler statt Rundung',
    (value) => {
      expect(parseAmount(value)).toEqual(fail('too-many-decimals'));
    },
  );

  it.each([
    [-5, 'negative'],
    [0, 'zero'],
    [Number.NaN, 'unreadable'],
    [Number.POSITIVE_INFINITY, 'unreadable'],
  ])('%d → %s', (value, code) => {
    expect(parseAmount(value)).toEqual(fail(code));
  });
});

describe('centsToXmlDecimal (Anlage 3 S. 110: Dezimaltrennzeichen Punkt)', () => {
  it.each([
    [1, '0.01'],
    [50, '0.50'],
    [4550, '45.50'],
    [123456, '1234.56'],
    [MAX_CENTS, '999999999.99'],
  ])('%d → %s', (cents, text) => {
    expect(centsToXmlDecimal(cents)).toBe(text);
  });

  it('lehnt negative und gebrochene Werte ab', () => {
    expect(() => centsToXmlDecimal(-1)).toThrow(RangeError);
    expect(() => centsToXmlDecimal(1.5)).toThrow(RangeError);
  });
});
