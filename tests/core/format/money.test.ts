import { describe, expect, it } from 'vitest';
import { formatEuro } from '../../../src/core/format/money.ts';

const nbsp = String.fromCodePoint(0xa0);

describe('formatEuro', () => {
  it.each([
    [0, '0,00'],
    [5, '0,05'],
    [4550, '45,50'],
    [123456, '1.234,56'],
    [99_999_999_999, '999.999.999,99'],
  ])('%d Cent → %s €', (cents, expected) => {
    expect(formatEuro(cents)).toBe(`${expected}${nbsp}€`);
  });

  it('kennzeichnet negative Beträge', () => {
    expect(formatEuro(-4550)).toBe(`${String.fromCodePoint(0x2212)}45,50${nbsp}€`);
  });

  it('lehnt Kommazahlen ab', () => {
    expect(() => formatEuro(12.5)).toThrow(RangeError);
  });
});
