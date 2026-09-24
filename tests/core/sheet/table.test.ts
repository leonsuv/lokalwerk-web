import { describe, expect, it } from 'vitest';
import { toTable } from '../../../src/core/sheet/table.ts';

describe('toTable', () => {
  it('trennt Kopfzeile und Daten und merkt sich die Zeilennummern der Datei', () => {
    const result = toTable([
      ['Empfänger', 'Betrag'],
      ['Anna', 12.5],
      ['Tom', '30,00'],
    ]);
    expect(result).toEqual({
      ok: true,
      table: {
        headers: ['Empfänger', 'Betrag'],
        rows: [
          ['Anna', 12.5],
          ['Tom', '30,00'],
        ],
        sourceRows: [2, 3],
      },
    });
  });

  it('entfernt leere Zeilen, auch solche nur aus Leerzeichen, und behält die echten Zeilennummern', () => {
    const result = toTable([[], ['Name', 'Betrag'], ['', '  '], ['Anna', 5], [''], ['Tom', 6]]);
    expect(result).toMatchObject({ ok: true, table: { sourceRows: [4, 6] } });
  });

  it('benennt leere Überschriften als „Spalte n“', () => {
    const result = toTable([
      ['Name', '', ' '],
      ['a', 'b', 'c'],
    ]);
    expect(result).toMatchObject({
      ok: true,
      table: { headers: ['Name', 'Spalte 2', 'Spalte 3'] },
    });
  });

  it('ergänzt Spalten, wenn Datenzeilen breiter als die Kopfzeile sind', () => {
    const result = toTable([['Name'], ['Anna', 'extra']]);
    expect(result).toMatchObject({
      ok: true,
      table: { headers: ['Name', 'Spalte 2'], rows: [['Anna', 'extra']] },
    });
  });

  it('füllt kürzere Zeilen mit leeren Zellen auf', () => {
    const result = toTable([['Name', 'Betrag'], ['Anna']]);
    expect(result).toMatchObject({ ok: true, table: { rows: [['Anna', '']] } });
  });

  it('wandelt null, Wahrheitswerte und Datum in Text', () => {
    const result = toTable([
      ['a', 'b', 'c'],
      [null, true, new Date('2026-09-25T00:00:00Z')],
    ]);
    expect(result).toMatchObject({ ok: true, table: { rows: [['', 'WAHR', '2026-09-25']] } });
  });

  it('meldet eine leere Datei', () => {
    expect(toTable([])).toEqual({ ok: false, code: 'empty' });
    expect(toTable([[''], ['  ']])).toEqual({ ok: false, code: 'empty' });
  });

  it('meldet eine Datei nur mit Kopfzeile', () => {
    expect(
      toTable([
        ['Name', 'Betrag'],
        ['', ''],
      ]),
    ).toEqual({ ok: false, code: 'no-data' });
  });
});
