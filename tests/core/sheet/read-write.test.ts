import { describe, expect, it } from 'vitest';
import { read, utils, write, type BookType, type CellObject } from 'xlsx';
import { writeXlsx } from '../../../src/core/sheet/write.ts';
import { readSheets, SheetError, sheetRows } from '../../../src/core/sheet/xlsx.ts';

/** Arbeitsmappe wie aus Excel: Datum als Zahl mit Datumsformat, Formel mit gespeichertem Ergebnis. */
function workbook(bookType: BookType): Uint8Array {
  const sheet = utils.aoa_to_sheet([
    ['Name', 'Betrag', 'Datum', 'PLZ', 'Aktiv'],
    ['Anna Müller', 1234.5, 46290, '01067', true],
    [],
    ['Ben', -0.1, 46290.5, '80331', false],
  ]);
  (sheet.C2 as CellObject).z = 'dd.mm.yyyy';
  (sheet.C4 as CellObject).z = 'dd.mm.yyyy hh:mm';
  sheet.F2 = { t: 'n', v: 3, f: '1+2' };
  sheet.G2 = { t: 'e', v: 0x07 };
  sheet['!ref'] = 'A1:G4';
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, 'Mitglieder');
  utils.book_append_sheet(book, utils.aoa_to_sheet([['zweites Blatt']]), 'Notizen');
  return new Uint8Array(write(book, { type: 'array', bookType }) as ArrayBuffer);
}

const date = (year: number, month: number, day: number, hours = 0) => ({
  year,
  month,
  day,
  hours,
  minutes: 0,
  seconds: 0,
});

describe('readSheets', () => {
  it.each(['xlsx', 'xls', 'ods'] as const)('liest alle Blätter einer .%s-Datei', (bookType) => {
    const sheets = readSheets(workbook(bookType));
    expect(sheets.map((s) => s.name)).toEqual(['Mitglieder', 'Notizen']);
    const [header, first, empty, second] = sheets[0]?.rows ?? [];
    expect(header?.slice(0, 5)).toEqual(['Name', 'Betrag', 'Datum', 'PLZ', 'Aktiv']);
    expect(first?.slice(0, 5)).toEqual(['Anna Müller', 1234.5, date(2026, 9, 25), '01067', true]);
    expect(empty?.every((v) => v === null)).toBe(true);
    expect(second?.slice(0, 5)).toEqual(['Ben', -0.1, date(2026, 9, 25, 12), '80331', false]);
    expect(sheets[1]?.rows).toEqual([['zweites Blatt']]);
  });

  it('übernimmt Formeln als Ergebnis und Fehler als Kürzel (.xlsx)', () => {
    const [sheet] = readSheets(workbook('xlsx'));
    expect(sheet?.rows[1]?.slice(5)).toEqual([3, '#DIV/0!']);
  });

  it('hängt nicht an formatierten, aber leeren Zellen bis zum Blattende', () => {
    const sheet = utils.aoa_to_sheet([['a'], [null, 'b']]);
    sheet['!ref'] = 'A1:XFD1048576';
    expect(sheetRows(sheet)).toEqual([
      ['a', null],
      [null, 'b'],
    ]);
  });

  it('meldet Mappen ohne belegte Zelle als leer', () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.aoa_to_sheet([]), 'Leer');
    const bytes = new Uint8Array(write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    expect(() => readSheets(bytes)).toThrow(SheetError);
  });
});

describe('writeXlsx', () => {
  const rows = [
    ['Name', 'Betrag', 'Datum', 'PLZ'],
    ['Anna', 12.5, date(2026, 9, 25), '01067'],
    ['Ben', '1.234,56', { ...date(2026, 9, 25), hours: 14, minutes: 30 }, ''],
  ];

  it('ergibt eine Datei, die sich mit denselben Werten wieder lesen lässt', () => {
    const [sheet] = readSheets(writeXlsx(rows));
    expect(sheet?.name).toBe('Tabelle1');
    expect(sheet?.rows).toEqual([
      ['Name', 'Betrag', 'Datum', 'PLZ'],
      ['Anna', 12.5, date(2026, 9, 25), '01067'],
      ['Ben', '1.234,56', { ...date(2026, 9, 25), hours: 14, minutes: 30 }, null],
    ]);
  });

  it('setzt Datumsformate und hält Text als Text', () => {
    const book = read(writeXlsx(rows), { type: 'array', cellNF: true });
    const sheet = book.Sheets.Tabelle1;
    expect(sheet?.C2).toMatchObject({ t: 'n', v: 46290, z: 'dd.mm.yyyy' });
    expect(sheet?.C3).toMatchObject({ z: 'dd.mm.yyyy hh:mm' });
    expect(sheet?.D2).toMatchObject({ t: 's', v: '01067' });
    expect(sheet?.B3).toMatchObject({ t: 's', v: '1.234,56' });
  });
});
