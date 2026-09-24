import { describe, expect, it } from 'vitest';
import {
  isAllowedChar,
  NAME_MAX_LENGTH,
  PURPOSE_MAX_LENGTH,
  REFERENCE_MAX_LENGTH,
  sanitizeSepaText,
} from '../../../src/core/sepa/charset.ts';

const c = (code: number) => String.fromCodePoint(code);
const clean = (text: string) => sanitizeSepaText(text, 1000);

describe('Anlage 3 26.11, S. 85: Grundzeichensatz bleibt unverändert', () => {
  const basic = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz':?,- (+.)/";
  it.each([...basic])('%j', (char) => {
    const input = `a${char}b`;
    expect(clean(input)).toMatchObject({ text: input, replacements: [] });
  });
});

describe('Anlage 3 26.11, S. 85–86: Zusatzzeichen bleiben unverändert', () => {
  // Ä Ö Ü ä ö ü ß & * $ %
  const extended = [0xc4, 0xd6, 0xdc, 0xe4, 0xf6, 0xfc, 0xdf, 0x26, 0x2a, 0x24, 0x25].map(c);
  it.each(extended)('%j', (char) => {
    const input = `a${char}b`;
    expect(clean(input)).toMatchObject({ text: input, replacements: [] });
  });

  it('ein typischer Vereinsname bleibt erhalten', () => {
    expect(clean('Förderverein Grün & Söhne e.V.').text).toBe('Förderverein Grün & Söhne e.V.');
  });
});

describe('Anlage 3 26.11, S. 84: Textfelder nicht nur aus Leerzeichen', () => {
  it.each(['', ' ', '   ', c(0xa0), '\t\n'])('%j ist leer', (input) => {
    expect(clean(input)).toMatchObject({ text: '', blank: true });
  });

  it('Leerzeichen am Rand werden entfernt, Text bleibt', () => {
    expect(clean('  Anna  ')).toMatchObject({ text: 'Anna', blank: false });
  });
});

describe('Anlage 3 26.11: Höchstlängen', () => {
  it('Namen höchstens 70 Zeichen (S. 86, 97, 103, 111)', () => {
    expect(NAME_MAX_LENGTH).toBe(70);
    const result = sanitizeSepaText('x'.repeat(75), NAME_MAX_LENGTH);
    expect(result).toMatchObject({ truncated: true, lengthBeforeTruncation: 75 });
    expect(result.text).toHaveLength(70);
  });

  it('Verwendungszweck höchstens 140 Zeichen (S. 114)', () => {
    expect(PURPOSE_MAX_LENGTH).toBe(140);
    expect(sanitizeSepaText('y'.repeat(140), PURPOSE_MAX_LENGTH)).toMatchObject({
      truncated: false,
    });
    expect(sanitizeSepaText('y'.repeat(141), PURPOSE_MAX_LENGTH).text).toHaveLength(140);
  });

  it('Referenzen höchstens 35 Zeichen (S. 253)', () => {
    expect(REFERENCE_MAX_LENGTH).toBe(35);
  });

  it('kürzt nach der Umschreibung, weil sie Text verlängern kann', () => {
    // 69 Zeichen + … (wird zu ...) = 72 Zeichen
    const result = sanitizeSepaText(`${'a'.repeat(69)}${c(0x2026)}`, 70);
    expect(result).toMatchObject({ truncated: true, lengthBeforeTruncation: 72 });
    expect(result.text).toBe(`${'a'.repeat(69)}.`);
  });

  it('lässt nach dem Kürzen kein Leerzeichen am Ende stehen', () => {
    expect(sanitizeSepaText(`${'a'.repeat(69)} b`, 70).text).toBe('a'.repeat(69));
  });

  it('meldet keine Kürzung, wenn nichts gekürzt wurde', () => {
    expect(sanitizeSepaText('kurz', 70)).toMatchObject({
      truncated: false,
      lengthBeforeTruncation: 4,
    });
  });
});

describe('plan.md O1/O8: eigene Umschreibung (NFD und eigene Liste)', () => {
  it.each([
    ['Café', 'Cafe'],
    ['Crème brûlée', 'Creme brulee'],
    ['São João', 'Sao Joao'],
    ['Dvořák', 'Dvorak'],
    ['Şahin', 'Sahin'],
    ['Ñandú', 'Nandu'],
  ])('%s → %s (Akzente entfernt)', (input, expected) => {
    expect(clean(input).text).toBe(expected);
  });

  it.each([
    [0xc6, 'AE'],
    [0xe6, 'ae'],
    [0x152, 'OE'],
    [0x153, 'oe'],
    [0xd8, 'O'],
    [0xf8, 'o'],
    [0x141, 'L'],
    [0x142, 'l'],
    [0x110, 'D'],
    [0x111, 'd'],
    [0xde, 'TH'],
    [0xfe, 'th'],
    [0x1e9e, 'SS'],
  ])('U+%s → %s (eigene Liste)', (code, expected) => {
    expect(clean(c(code))).toMatchObject({
      text: expected,
      replacements: [{ from: c(code), to: expected }],
    });
  });

  it('Beispiele mit Namen', () => {
    expect(clean(`${c(0x141)}ód${c(0x17a)}`).text).toBe('Lodz');
    expect(clean(`S${c(0xf8)}ren ${c(0xc6)}lberg`).text).toBe('Soren AElberg');
  });
});

describe('plan.md O2: Typografie', () => {
  it.each([
    [0x2013, '-'],
    [0x2014, '-'],
    [0x201e, "'"],
    [0x201c, "'"],
    [0x201d, "'"],
    [0x2018, "'"],
    [0x2019, "'"],
    [0x2026, '...'],
  ])('U+%s → %j', (code, expected) => {
    expect(clean(`a${c(code)}b`).text).toBe(`a${expected}b`);
  });

  it.each([0xa0, 0x2002, 0x2009, 0x202f, 0x3000, 0x09, 0x0a, 0x0d])(
    'Leerzeichen U+%s → normales Leerzeichen',
    (code) => {
      expect(clean(`a${c(code)}b`)).toMatchObject({
        text: 'a b',
        replacements: [{ from: c(code), to: ' ' }],
      });
    },
  );

  it('Beispiel aus Excel', () => {
    expect(clean(`Miete ${c(0x2013)} ${c(0x201e)}März${c(0x201c)}`).text).toBe("Miete - 'März'");
  });
});

describe('plan.md O3: übrige Zeichen', () => {
  it.each([
    ['"', "'"],
    ['<', '.'],
    ['>', '.'],
    ['@', '.'],
    ['#', '.'],
    ['!', '.'],
    ['_', '.'],
    ['=', '.'],
    [';', '.'],
    [c(0x20ac), '.'],
    [c(0x3a9), '.'], // griechisches Omega
    [c(0x416), '.'], // kyrillisches Sche
    [c(0x4e2d), '.'], // chinesisch
    [c(0x1f600), '.'], // Emoji außerhalb der BMP: ein Punkt, nicht zwei
  ])('%j → %j', (input, expected) => {
    expect(clean(`a${input}b`)).toMatchObject({
      text: `a${expected}b`,
      replacements: [{ from: input, to: expected }],
    });
  });

  it('meldet jede Ersetzung, aber jede nur einmal und in Reihenfolge', () => {
    expect(clean('Café & Crème @ Café').replacements).toEqual([
      { from: c(0xe9), to: 'e' },
      { from: c(0xe8), to: 'e' },
      { from: '@', to: '.' },
    ]);
  });

  it('meldet nichts, wenn nichts ersetzt wurde', () => {
    expect(clean('Rechnung 2026-117').replacements).toEqual([]);
  });
});

describe('Unsichtbare Formatzeichen (Kategorie Cf) werden entfernt, mit Warnung', () => {
  it.each([
    [0xad, 'weiches Trennzeichen'],
    [0x200b, 'Zero-Width-Space'],
    [0x200c, 'Zero-Width-Non-Joiner'],
    [0x200d, 'Zero-Width-Joiner'],
    [0x200e, 'Links-nach-rechts-Markierung'],
    [0x200f, 'Rechts-nach-links-Markierung'],
    [0x202a, 'Richtungseinbettung'],
    [0x2066, 'Richtungsisolierung'],
    [0x2060, 'Word Joiner'],
    [0xfeff, 'BOM / Zero-Width-No-Break-Space'],
  ])('U+%s (%s)', (code) => {
    expect(clean(`Rech${c(code)}nung`)).toMatchObject({
      text: 'Rechnung',
      replacements: [{ from: c(code), to: '' }],
    });
  });

  it('entfernt Formatzeichen auch in Emoji-Folgen, das Emoji selbst wird ein Punkt', () => {
    // Familie: Mann + ZWJ + Frau
    expect(clean(`a${c(0x1f468)}${c(0x200d)}${c(0x1f469)}b`).text).toBe('a..b');
  });

  it('ein Text nur aus Formatzeichen ist leer', () => {
    expect(clean(`${c(0x200b)}${c(0xad)}`)).toMatchObject({ text: '', blank: true });
  });
});

describe('Ergebnis enthält nur erlaubte Zeichen', () => {
  it('für jedes Zeichen der Basic Multilingual Plane und ausgewählte weitere', () => {
    const codes: number[] = [];
    for (let code = 0; code <= 0xffff; code++) if (code < 0xd800 || code > 0xdfff) codes.push(code);
    codes.push(0x1f600, 0x1f468, 0x10348, 0x1d11e);
    for (const code of codes) {
      const { text } = clean(`a${c(code)}b`);
      const bad = [...text].find((ch) => !isAllowedChar(ch));
      if (bad !== undefined)
        throw new Error(`U+${code.toString(16)} ergibt unerlaubtes ${JSON.stringify(bad)}`);
    }
  });
});
