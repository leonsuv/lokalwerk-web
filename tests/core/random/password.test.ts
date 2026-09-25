import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AMBIGUOUS,
  alphabetSize,
  entropyBits,
  generatePassword,
  GROUPS,
  randomBelow,
  rateAgainstBsi,
  type RandomSource,
} from '../../../src/core/random/password.ts';

const crypto: RandomSource = (buffer) => webcrypto.getRandomValues(buffer);

/** Liefert der Reihe nach die angegebenen Werte. */
const sequence = (...values: number[]): RandomSource => {
  let i = 0;
  return (buffer) => {
    buffer[0] = values[i++ % values.length] ?? 0;
    return buffer;
  };
};

describe('randomBelow', () => {
  it('verwirft Werte über der letzten vollen Runde, statt Modulo zu nehmen', () => {
    // n = 3: 2^32 mod 3 = 1, also ist 2^32 − 1 der einzige verworfene Wert
    expect(randomBelow(3, sequence(2 ** 32 - 1, 7))).toBe(1);
    expect(randomBelow(3, sequence(2 ** 32 - 2))).toBe((2 ** 32 - 2) % 3);
  });

  it('ist mit echtem Zufall ungefähr gleichverteilt', () => {
    const counts = new Array<number>(7).fill(0);
    const n = 70_000;
    for (let i = 0; i < n; i++) {
      const k = randomBelow(7, crypto);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    // Chi-Quadrat mit 6 Freiheitsgraden; 22,46 ist das 0,999-Quantil
    const expected = n / 7;
    const chi = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    expect(chi).toBeLessThan(22.46);
  });

  it('lehnt unsinnige Bereiche ab', () => {
    expect(() => randomBelow(0, crypto)).toThrow(RangeError);
    expect(() => randomBelow(1.5, crypto)).toThrow(RangeError);
  });
});

describe('generatePassword', () => {
  const all = ['upper', 'lower', 'digits', 'symbols'] as const;

  it('hat die gewünschte Länge und nur Zeichen aus den gewählten Gruppen', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword(
        { length: 12, groups: ['lower', 'digits'], avoidAmbiguous: false },
        crypto,
      );
      expect(pw).toMatch(/^[a-z0-9]{12}$/);
    }
  });

  it('enthält jede gewählte Gruppe mindestens einmal, auch bei kurzer Länge', () => {
    for (let i = 0; i < 500; i++) {
      const pw = generatePassword({ length: 4, groups: all, avoidAmbiguous: false }, crypto);
      for (const g of all)
        expect(
          [...pw].some((c) => GROUPS[g].includes(c)),
          `${pw} ${g}`,
        ).toBe(true);
    }
  });

  it('lässt verwechselbare Zeichen weg, wenn gewünscht', () => {
    for (let i = 0; i < 300; i++) {
      const pw = generatePassword({ length: 64, groups: all, avoidAmbiguous: true }, crypto);
      for (const c of AMBIGUOUS) expect(pw).not.toContain(c);
    }
  });

  it('enthält nie Umlaute, ß, € oder Leerzeichen (BSI)', () => {
    const chars = Object.values(GROUPS).join('');
    expect(chars).toMatch(/^[\x21-\x7e]+$/);
    expect(chars).not.toMatch(/["'`\\ ]/);
  });

  it('lehnt keine Gruppe und zu kurze oder zu lange Passwörter ab', () => {
    expect(() =>
      generatePassword({ length: 12, groups: [], avoidAmbiguous: false }, crypto),
    ).toThrow();
    expect(() =>
      generatePassword({ length: 3, groups: all, avoidAmbiguous: false }, crypto),
    ).toThrow();
    expect(() =>
      generatePassword({ length: 129, groups: ['lower'], avoidAmbiguous: false }, crypto),
    ).toThrow();
  });
});

describe('Stärke', () => {
  it('Zeichenvorrat und Bit', () => {
    expect(alphabetSize(['upper', 'lower', 'digits'], false)).toBe(62);
    expect(alphabetSize(['upper', 'lower', 'digits'], true)).toBe(62 - 6);
    expect(entropyBits(20, 64)).toBe(120);
    expect(entropyBits(10, 1)).toBe(0);
  });

  it.each([
    [25, 1, { ok: true, example: 'long' }],
    [20, 2, { ok: true, example: 'long-two-kinds' }],
    [20, 1, { ok: false }],
    [8, 4, { ok: true, example: 'short-four-kinds' }],
    [12, 3, { ok: false }],
    [7, 4, { ok: false }],
  ] as const)('%i Zeichen, %i Zeichenarten → %o', (length, kinds, rating) => {
    expect(rateAgainstBsi(length, kinds)).toEqual(rating);
  });
});
