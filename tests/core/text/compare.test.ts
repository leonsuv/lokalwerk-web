import { describe, expect, it } from 'vitest';
import { compareTexts, type Row } from '../../../src/core/text/compare.ts';

const plain = { ignoreCase: false, ignoreWhitespace: false };
const show = (rows: Row[]) =>
  rows.map((r) =>
    r.kind === 'equal'
      ? `  ${r.text}`
      : `${r.kind === 'delete' ? '-' : '+'} ${r.segments.map((s) => (s.changed ? `[${s.text}]` : s.text)).join('')}`,
  );

describe('compareTexts', () => {
  it('markiert geänderte Wörter in geänderten Zeilen', () => {
    const result = compareTexts(
      'Der Mieter zahlt 500 Euro.\nKündigung: drei Monate.\nEnde',
      'Der Mieter zahlt 550 Euro.\nKündigung: drei Monate.\nEnde',
      plain,
    );
    expect(show(result?.rows ?? [])).toEqual([
      '- Der Mieter zahlt [500] Euro.',
      '+ Der Mieter zahlt [550] Euro.',
      '  Kündigung: drei Monate.',
      '  Ende',
    ]);
    expect(result).toMatchObject({ deleted: 1, inserted: 1, unchanged: 2 });
  });

  it('zählt Zeilennummern auf beiden Seiten richtig', () => {
    const result = compareTexts('a\nb\nc', 'a\nx\ny\nc', plain);
    expect(result?.rows).toEqual([
      { kind: 'equal', oldLine: 1, newLine: 1, text: 'a' },
      { kind: 'delete', oldLine: 2, segments: [{ text: 'b', changed: true }] },
      { kind: 'insert', newLine: 2, segments: [{ text: 'x', changed: true }] },
      { kind: 'insert', newLine: 3, segments: [{ text: 'y', changed: true }] },
      { kind: 'equal', oldLine: 3, newLine: 4, text: 'c' },
    ]);
  });

  it('kann Groß-/Kleinschreibung und Leerraum übergehen', () => {
    const text = 'Der  Vertrag ';
    expect(compareTexts(text, 'der vertrag', plain)?.unchanged).toBe(0);
    expect(
      compareTexts(text, 'der vertrag', { ignoreCase: true, ignoreWhitespace: true })?.unchanged,
    ).toBe(1);
  });

  it('meldet gleiche Texte als unverändert und leere Texte ohne Zeilen', () => {
    expect(compareTexts('a\nb', 'a\nb\n', plain)).toMatchObject({
      deleted: 0,
      inserted: 0,
      unchanged: 2,
    });
    expect(compareTexts('', '', plain)?.rows).toEqual([]);
  });
});
