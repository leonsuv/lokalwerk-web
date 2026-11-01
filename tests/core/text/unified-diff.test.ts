import { describe, expect, it } from 'vitest';
import { compareTexts } from '../../../src/core/text/compare.ts';
import { toUnifiedDiff } from '../../../src/core/text/unified-diff.ts';

const options = { ignoreCase: false, ignoreWhitespace: false };
const diffOf = (a: string, b: string, context?: number) => {
  const result = compareTexts(a, b, options);
  if (!result) throw new Error('zu viele Änderungen');
  return toUnifiedDiff(result.rows, 'a.txt', 'b.txt', context);
};

describe('toUnifiedDiff', () => {
  it('liefert nichts, wenn beide Texte gleich sind', () => {
    expect(diffOf('a\nb\nc', 'a\nb\nc')).toBe('');
  });

  it('schreibt eine geänderte Zeile mit Umfeld wie diff -u', () => {
    expect(diffOf('eins\nzwei\ndrei\nvier\nfünf', 'eins\nzwei\nDREI\nvier\nfünf')).toBe(
      [
        '--- a.txt',
        '+++ b.txt',
        '@@ -1,5 +1,5 @@',
        ' eins',
        ' zwei',
        '-drei',
        '+DREI',
        ' vier',
        ' fünf',
        '',
      ].join('\n'),
    );
  });

  it('trennt weit auseinanderliegende Änderungen in zwei Abschnitte', () => {
    const a = Array.from({ length: 20 }, (_, i) => `z${i + 1}`).join('\n');
    const b = a.replace('z2\n', 'z2 neu\n').replace('z19', 'z19 neu');
    const out = diffOf(a, b);
    expect(out.match(/^@@/gm)).toHaveLength(2);
    expect(out).toContain('@@ -1,5 +1,5 @@');
    expect(out).toContain('@@ -16,5 +16,5 @@');
  });

  it('gibt bei reinem Einfügen am Anfang als alte Startzeile 0 an', () => {
    expect(diffOf('', 'neu')).toBe(
      ['--- a.txt', '+++ b.txt', '@@ -0,0 +1 @@', '+neu', ''].join('\n'),
    );
  });

  it('ohne Umfeld stehen nur die Änderungen im Abschnitt', () => {
    expect(diffOf('a\nb\nc', 'a\nX\nc', 0)).toBe(
      ['--- a.txt', '+++ b.txt', '@@ -2 +2 @@', '-b', '+X', ''].join('\n'),
    );
  });
});
