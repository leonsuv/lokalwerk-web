import { describe, expect, it } from 'vitest';
import {
  diff,
  lineKey,
  splitLines,
  splitWords,
  type DiffPart,
} from '../../../src/core/text/diff.ts';

/** Länge der längsten gemeinsamen Teilfolge, klassisch per Tabelle (Referenz). */
function lcs<T>(a: T[], b: T[]): number {
  const row = new Array<number>(b.length + 1).fill(0);
  for (const x of a) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j] ?? 0;
      row[j] = x === b[j - 1] ? diag + 1 : Math.max(up, row[j - 1] ?? 0);
      diag = up;
    }
  }
  return row[b.length] ?? 0;
}

const side = <T>(parts: DiffPart<T>[], keep: 'delete' | 'insert') =>
  parts.filter((p) => p.kind === 'equal' || p.kind === keep).flatMap((p) => p.items);
const edits = <T>(parts: DiffPart<T>[]) =>
  parts.filter((p) => p.kind !== 'equal').reduce((s, p) => s + p.items.length, 0);

describe('diff (Myers)', () => {
  it('findet einfache Änderungen', () => {
    expect(diff([...'ABCABBA'], [...'CBABAC'])?.length).toBeGreaterThan(0);
    expect(diff(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual([
      { kind: 'equal', items: ['a'] },
      { kind: 'delete', items: ['b'] },
      { kind: 'insert', items: ['x'] },
      { kind: 'equal', items: ['c'] },
    ]);
    expect(diff([], [])).toEqual([]);
    expect(diff([], ['a'])).toEqual([{ kind: 'insert', items: ['a'] }]);
    expect(diff(['a'], [])).toEqual([{ kind: 'delete', items: ['a'] }]);
  });

  it('Beispiel aus Myers (1986): ABCABBA → CBABAC braucht 5 Änderungen', () => {
    const parts = diff([...'ABCABBA'], [...'CBABAC']) ?? [];
    expect(edits(parts)).toBe(5);
  });

  it('ergibt bei zufälligen Folgen beide Seiten zurück und ist minimal (Vergleich mit LCS)', () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    for (let round = 0; round < 400; round++) {
      const a = Array.from({ length: rand(25) }, () => 'abcd'[rand(4)] ?? 'a');
      const b = Array.from({ length: rand(25) }, () => 'abcd'[rand(4)] ?? 'a');
      const parts = diff(a, b);
      if (!parts) throw new Error('kein Ergebnis');
      expect(side(parts, 'delete')).toEqual(a);
      expect(side(parts, 'insert')).toEqual(b);
      expect(edits(parts)).toBe(a.length + b.length - 2 * lcs(a, b));
    }
  });

  it('bricht bei zu vielen Änderungen ab', () => {
    expect(diff([...'aaaa'], [...'bbbb'], undefined, 3)).toBeNull();
    expect(diff([...'aaaa'], [...'bbbb'], undefined, 8)).not.toBeNull();
  });

  it('nutzt die Vergleichsfunktion', () => {
    const parts = diff(['Hallo'], ['hallo'], (x, y) => x.toLowerCase() === y.toLowerCase());
    expect(parts).toEqual([{ kind: 'equal', items: ['Hallo'] }]);
  });

  it('ist bei langen Texten mit wenigen Änderungen schnell', () => {
    const a = Array.from({ length: 20_000 }, (_, i) => `Zeile ${i}`);
    const b = [...a];
    b[5000] = 'geändert';
    b.splice(15_000, 3);
    const t = performance.now();
    const parts = diff(a, b) ?? [];
    expect(performance.now() - t).toBeLessThan(500);
    expect(edits(parts)).toBe(5);
  });
});

describe('Zerlegen und Vergleichsschlüssel', () => {
  it('Zeilen, auch mit Windows- und alten Mac-Zeilenenden', () => {
    expect(splitLines('a\r\nb\rc\n')).toEqual(['a', 'b', 'c']);
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b']);
    expect(splitLines('')).toEqual([]);
  });

  it('Wörter, Leerraum und Satzzeichen einzeln', () => {
    expect(splitWords('Straße 12, Köln.')).toEqual(['Straße', ' ', '12', ',', ' ', 'Köln', '.']);
    expect(splitWords('')).toEqual([]);
  });

  it('Schlüssel ohne Groß-/Kleinschreibung und mit vereinheitlichtem Leerraum', () => {
    const both = { ignoreCase: true, ignoreWhitespace: true };
    expect(lineKey('  Der   Vertrag ', both)).toBe(lineKey('der vertrag', both));
    expect(lineKey('ÄRGER', both)).toBe('ärger');
    expect(lineKey(' a ', { ignoreCase: false, ignoreWhitespace: false })).toBe(' a ');
  });
});
