import { describe, expect, it } from 'vitest';
import { CsvError, parseCsv, stripSepHint } from '../../../src/core/csv/parse.ts';

describe('parseCsv (RFC 4180)', () => {
  it('trennt Felder und Zeilen', () => {
    expect(parseCsv('a;b\n1;2', ';')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('erkennt CRLF, LF und CR', () => {
    expect(parseCsv('a,b\r\n1,2\r3,4\n', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('ignoriert einen abschließenden Zeilenumbruch', () => {
    expect(parseCsv('a;b\n', ';')).toEqual([['a', 'b']]);
  });

  it('erlaubt Trennzeichen in Anführungszeichen', () => {
    expect(parseCsv('"Müller; Anna";"1.234,56"', ';')).toEqual([['Müller; Anna', '1.234,56']]);
  });

  it('erlaubt Zeilenumbrüche in Anführungszeichen', () => {
    expect(parseCsv('"Zeile 1\nZeile 2";x\ny;z', ';')).toEqual([
      ['Zeile 1\nZeile 2', 'x'],
      ['y', 'z'],
    ]);
  });

  it('wandelt "" in ein Anführungszeichen', () => {
    expect(parseCsv('"Verein ""Grün"" e.V.",5', ',')).toEqual([['Verein "Grün" e.V.', '5']]);
  });

  it('behält leere Felder', () => {
    expect(parseCsv('a;;c\n;;', ';')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });

  it('liest Tabulator-getrennte Dateien', () => {
    expect(parseCsv('a\tb\n1\t2', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('liefert für leeren Text keine Zeilen', () => {
    expect(parseCsv('', ';')).toEqual([]);
  });

  it('meldet ein nicht geschlossenes Anführungszeichen mit Zeilennummer', () => {
    try {
      parseCsv('a;b\n"offen;x\ny', ';');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CsvError);
      expect(error).toMatchObject({ code: 'unterminated-quote', line: 2 });
    }
  });
});

describe('stripSepHint (Excel „sep=“)', () => {
  it('erkennt und entfernt die Zeile', () => {
    expect(stripSepHint('sep=;\r\na;b')).toEqual({ delimiter: ';', text: 'a;b' });
    expect(stripSepHint('SEP=,\na,b')).toEqual({ delimiter: ',', text: 'a,b' });
  });

  it('lässt Text ohne Hinweis unverändert', () => {
    expect(stripSepHint('a;b')).toEqual({ delimiter: null, text: 'a;b' });
  });
});
