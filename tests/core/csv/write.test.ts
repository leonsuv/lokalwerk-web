import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../../src/core/csv/parse.ts';
import { toCsv } from '../../../src/core/csv/write.ts';

describe('toCsv (RFC 4180)', () => {
  it('trennt Felder und Zeilen, Zeilenende CRLF', () => {
    expect(
      toCsv(
        [
          ['a', 'b'],
          ['1', '2'],
        ],
        ';',
      ),
    ).toBe('a;b\r\n1;2');
  });

  it('setzt nur Felder mit Trennzeichen, Anführungszeichen oder Umbruch in Anführungszeichen', () => {
    expect(toCsv([['a;b', 'Er sagte "Hallo"', 'Zeile\nzwei', '12,50', 'x']], ';')).toBe(
      '"a;b";"Er sagte ""Hallo""";"Zeile\nzwei";12,50;x',
    );
    expect(toCsv([['12,50', 'a;b']], ',')).toBe('"12,50",a;b');
    expect(toCsv([['a\tb', 'c']], '\t')).toBe('"a\tb"\tc');
  });

  it('verändert Werte nicht, auch nicht solche, die mit = beginnen', () => {
    expect(toCsv([['=SUMME(A1)', '+49', ' leer ']], ';')).toBe('=SUMME(A1);+49; leer ');
  });

  it('lässt sich mit dem eigenen Leser verlustfrei zurücklesen', () => {
    const rows = [
      ['Name', 'Notiz', 'Betrag'],
      ['Müller; Anna', 'mit "Zitat"\r\nund Umbruch', '12,50'],
      ['', 'leer davor', ''],
    ];
    for (const d of [';', ',', '\t'] as const) expect(parseCsv(toCsv(rows, d), d)).toEqual(rows);
  });
});
