import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { utils, write, type BookType } from 'xlsx';
import { readFirstSheet, SheetError } from '../../../src/core/sheet/xlsx.ts';

/** Teil der SheetJS-API, der ohne Typen ausgeliefert wird. */
interface CfbApi {
  utils: { cfb_new(): object; cfb_add(container: object, path: string, data: Uint8Array): void };
  write(container: object, options: { type: 'array' }): ArrayLike<number>;
}

const rows = [
  ['Empfänger', 'IBAN', 'Betrag', 'Verwendungszweck'],
  ['Sportverein Musterstadt e.V.', 'DE89370400440532013000', 120, 'Hallenmiete'],
  [],
  ['Anna Beispiel', 'DE50345678900123456789', 45.5, ''],
  ['Kiosk am Markt GmbH', 'DE89123456781049638712', '1.234,56', 'Rechnung 2026-117'],
];

function workbook(bookType: BookType): Uint8Array {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), 'Überweisungen');
  utils.book_append_sheet(book, utils.aoa_to_sheet([['zweites Blatt']]), 'Anderes');
  return new Uint8Array(write(book, { type: 'array', bookType }) as ArrayBuffer);
}

function errorCode(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof SheetError) return error.code;
    throw error;
  }
  throw new Error('kein Fehler geworfen');
}

describe('readFirstSheet', () => {
  it.each(['xlsx', 'xls', 'ods'] as const)('liest das erste Blatt einer .%s-Datei', (bookType) => {
    const result = readFirstSheet(workbook(bookType));
    expect(result[0]).toEqual(rows[0]);
    expect(result).toContainEqual(['Anna Beispiel', 'DE50345678900123456789', 45.5, '']);
    expect(result.flat()).not.toContain('zweites Blatt');
  });

  it('liefert Zahlen als Zahlen und Texte als Texte', () => {
    const result = readFirstSheet(workbook('xlsx'));
    const [, first] = result;
    expect(first?.[2]).toBe(120);
    expect(result.find((r) => r[0] === 'Kiosk am Markt GmbH')?.[2]).toBe('1.234,56');
  });

  it('lässt leere Zeilen weg', () => {
    expect(readFirstSheet(workbook('xlsx'))).toHaveLength(4);
  });

  it('liest eine als „.xls“ gespeicherte HTML-Tabelle und rät keine Zahlen (12,50 bleibt nicht 1250)', () => {
    const html =
      '<html><body><table><tr><td>Name</td><td>Betrag</td></tr><tr><td>Anna</td><td>12,50</td></tr></table></body></html>';
    expect(readFirstSheet(new TextEncoder().encode(html))).toEqual([
      ['Name', 'Betrag'],
      ['Anna', '12,50'],
    ]);
  });

  it('meldet eine leere Datei', () => {
    expect(errorCode(() => readFirstSheet(new Uint8Array()))).toBe('empty');
  });

  it('meldet eine abgeschnittene .xlsx-Datei als beschädigt', () => {
    expect(errorCode(() => readFirstSheet(workbook('xlsx').slice(0, 300)))).toBe('damaged');
  });

  it('erkennt einen verschlüsselten Office-Container', () => {
    // Synthetischer OLE-Container mit den Strömen einer verschlüsselten .xlsx-Datei.
    // Eine echte verschlüsselte Datei lässt sich hier ohne Excel nicht erzeugen.
    const cfb = (XLSX as unknown as { CFB: CfbApi }).CFB;
    const container = cfb.utils.cfb_new();
    cfb.utils.cfb_add(container, '/EncryptionInfo', new Uint8Array(64));
    cfb.utils.cfb_add(container, '/EncryptedPackage', new Uint8Array(256));
    const bytes = new Uint8Array(cfb.write(container, { type: 'array' }));
    expect(errorCode(() => readFirstSheet(bytes))).toBe('encrypted');
  });

  it.each([
    ['PDF', '%PDF-1.7\n1 0 obj << >> endobj'],
    ['CSV-Text', 'Name;Betrag\nAnna;12,50'],
  ])('lehnt %s mit Tabellen-Endung ab statt Unsinn zu lesen', (_label, text) => {
    expect(errorCode(() => readFirstSheet(new TextEncoder().encode(text)))).toBe('not-spreadsheet');
  });

  it('lehnt Zufallsbytes ab', () => {
    const bytes = new Uint8Array(500).map((_, i) => (i * 7919 + 1) % 256);
    expect(errorCode(() => readFirstSheet(bytes))).toBe('not-spreadsheet');
  });
});
