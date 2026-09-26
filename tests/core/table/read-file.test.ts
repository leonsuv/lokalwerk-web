import { describe, expect, it } from 'vitest';
import { writeXlsx } from '../../../src/core/sheet/write.ts';
import { readTableFile } from '../../../src/core/table/read-file.ts';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('readTableFile', () => {
  it('liest CSV mit erkanntem Trennzeichen und lässt leere Zeilen am Ende weg', () => {
    const result = readTableFile(bytes('Name;IBAN\nAnna;DE89370400440532013000\n;\n'), 'csv');
    expect(result).toMatchObject({
      ok: true,
      table: {
        text: [
          ['Name', 'IBAN'],
          ['Anna', 'DE89370400440532013000'],
        ],
        delimiter: ';',
        source: 'csv',
      },
    });
  });

  it('liest Excel mit Werten im Original', () => {
    const xlsx = writeXlsx([
      ['Name', 'Betrag'],
      ['Anna', 12.5],
    ]);
    const result = readTableFile(xlsx, 'workbook');
    expect(result.ok && result.table.values?.[1]).toEqual(['Anna', 12.5]);
    expect(result.ok && result.table.text[1]).toEqual(['Anna', '12,5']);
  });

  it('meldet leere Dateien, fehlende Datenzeilen, offene Anführungszeichen und fremde Formate', () => {
    expect(readTableFile(new Uint8Array(), 'csv')).toEqual({ ok: false, code: 'empty' });
    expect(readTableFile(bytes('Nur Kopf\n'), 'csv')).toEqual({ ok: false, code: 'no-data' });
    expect(readTableFile(bytes('a;b\n"offen;1\n'), 'csv')).toMatchObject({
      ok: false,
      code: 'unterminated-quote',
    });
    expect(readTableFile(bytes('x'), 'other')).toEqual({ ok: false, code: 'unsupported' });
  });
});
