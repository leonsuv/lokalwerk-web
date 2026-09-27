import { describe, expect, it } from 'vitest';
import {
  checkPageNumberInput,
  pageNumberText,
  samePageNumbers,
  type PageNumberOptions,
} from '../../../src/core/pdf/page-numbers.ts';
import { pageNumberText as fromStamp } from '../../../src/core/pdf/stamp.ts';

const BASE: PageNumberOptions = {
  format: 'seite-n-von-m',
  anchor: 'bottom-center',
  fromPage: 1,
  startAt: 1,
  fontSize: 10,
  marginMm: 10,
};

describe('Seitenzahlen: Eingaben', () => {
  it('„Ab Seite“ muss eine Seite des Dokuments sein', () => {
    expect(checkPageNumberInput(1, 1, 3)).toBeNull();
    expect(checkPageNumberInput(3, 1, 3)).toBeNull();
    expect(checkPageNumberInput(4, 1, 3)).toBe('from');
    expect(checkPageNumberInput(0, 1, 3)).toBe('from');
    expect(checkPageNumberInput(1.5, 1, 3)).toBe('from');
    expect(checkPageNumberInput(Number.NaN, 1, 3)).toBe('from');
    // Ohne Seiten passt keine Seite
    expect(checkPageNumberInput(1, 1, 0)).toBe('from');
  });

  it('„Erste Zahl“ muss eine ganze Zahl ab 0 sein; „Ab Seite“ wird zuerst geprüft', () => {
    expect(checkPageNumberInput(1, 0, 3)).toBeNull();
    expect(checkPageNumberInput(1, -1, 3)).toBe('start');
    expect(checkPageNumberInput(1, 2.5, 3)).toBe('start');
    expect(checkPageNumberInput(9, -1, 3)).toBe('from');
  });

  it('vergleicht Einstellungen Feld für Feld', () => {
    expect(samePageNumbers(BASE, { ...BASE })).toBe(true);
    for (const change of [
      { format: 'n' },
      { anchor: 'top-left' },
      { fromPage: 2 },
      { startAt: 0 },
      { fontSize: 12 },
      { marginMm: 5 },
    ] as const) {
      expect(samePageNumbers(BASE, { ...BASE, ...change })).toBe(false);
    }
  });

  it('stamp.ts gibt dieselbe Textfunktion weiter', () => {
    expect(fromStamp).toBe(pageNumberText);
    expect(pageNumberText('n-von-m', 2, 7)).toBe('2 / 7');
  });
});
