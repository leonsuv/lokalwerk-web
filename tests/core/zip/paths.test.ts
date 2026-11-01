import { describe, expect, it } from 'vitest';
import { safeEntryPath, uniquePaths } from '../../../src/core/zip/paths.ts';

describe('safeEntryPath', () => {
  it('behält Ordner und wandelt Rückwärts-Schrägstriche um', () => {
    expect(safeEntryPath('Akte/2026/rechnung.pdf')).toBe('Akte/2026/rechnung.pdf');
    expect(safeEntryPath('Akte\\2026\\rechnung.pdf')).toBe('Akte/2026/rechnung.pdf');
  });

  it.each([
    ['../../etc/passwd', 'etc/passwd'],
    ['/abs/pfad/datei.txt', 'abs/pfad/datei.txt'],
    ['a/./b//c/../d.txt', 'a/b/c/d.txt'],
    ['C:\\Windows\\system.ini', 'C_/Windows/system.ini'],
    ['..', 'datei'],
    ['', 'datei'],
    ['   ', 'datei'],
  ])('bereinigt %j zu %j', (raw, expected) => {
    expect(safeEntryPath(raw)).toBe(expected);
  });

  it('ersetzt Steuerzeichen; ein Teil wie „\u001f..“ wird zu einem harmlosen Namen „_..“', () => {
    const p = safeEntryPath('a\u0000b/\u001f../../x');
    expect(p).toBe('a_b/_../x');
    expect(p.split('/')).not.toContain('..');
  });

  it('lässt nie einen Teil „..“ oder einen führenden Schrägstrich übrig', () => {
    for (const raw of ['../a', 'a/../../b', '/../c', '....//d', 'e/..\\..\\f', '..%2f..%2fg']) {
      const p = safeEntryPath(raw);
      expect(p.split('/')).not.toContain('..');
      expect(p.startsWith('/')).toBe(false);
    }
  });

  it('kürzt zu lange Pfade auf höchstens 1024 Byte', () => {
    expect(
      new TextEncoder().encode(safeEntryPath(`${'ä'.repeat(900)}/x.txt`)).length,
    ).toBeLessThanOrEqual(1024);
  });
});

describe('uniquePaths', () => {
  it('nummeriert doppelte Pfade im selben Ordner, Groß/Klein zählt gleich', () => {
    expect(uniquePaths(['a/foto.jpg', 'a/FOTO.jpg', 'a/foto.jpg', 'b/foto.jpg'])).toEqual([
      'a/foto.jpg',
      'a/FOTO (2).jpg',
      'a/foto (3).jpg',
      'b/foto.jpg',
    ]);
  });

  it('macht aus unsicheren Pfaden sichere', () => {
    expect(uniquePaths(['../x.txt', 'x.txt'])).toEqual(['x.txt', 'x (2).txt']);
  });
});
