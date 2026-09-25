/**
 * Excel-Datei (.xlsx) aus Zeilen schreiben, mit SheetJS CE (vendor/README.md).
 * Text bleibt Text, auch wenn er wie eine Zahl aussieht; Zahlen und Datumswerte kommen schon
 * gedeutet an (src/core/sheet/values.ts, parseCellText).
 * SheetJS schreibt fest „SheetJS“ als Anwendung in docProps/app.xml (docs/sheetjs-adressen.md).
 */

import { utils, writeXLSX, type CellObject, type WorkSheet } from 'xlsx';
import { excelSerial, type WallClock } from './values.ts';

export type OutputCell = string | number | WallClock;

const MAX_COLUMN_WIDTH = 50;

function dateFormat(w: WallClock): string {
  if (w.seconds !== 0) return 'dd.mm.yyyy hh:mm:ss';
  if (w.hours !== 0 || w.minutes !== 0) return 'dd.mm.yyyy hh:mm';
  return 'dd.mm.yyyy';
}

function cell(value: OutputCell): CellObject | null {
  if (typeof value === 'string') return value === '' ? null : { t: 's', v: value };
  if (typeof value === 'number') return { t: 'n', v: value };
  const serial = excelSerial(value);
  // parseCellText liefert nur Daten ab dem 1.3.1900; sonst sicherheitshalber als Text
  if (serial === null) return { t: 's', v: `${value.day}.${value.month}.${value.year}` };
  return { t: 'n', v: serial, z: dateFormat(value) };
}

export function writeXlsx(
  rows: readonly (readonly OutputCell[])[],
  sheetName = 'Tabelle1',
): Uint8Array {
  const sheet: WorkSheet = {};
  let columns = 0;
  const widths: number[] = [];
  rows.forEach((row, r) => {
    columns = Math.max(columns, row.length);
    row.forEach((value, c) => {
      const out = cell(value);
      if (!out) return;
      sheet[utils.encode_cell({ r, c })] = out;
      const length = typeof value === 'string' ? value.length : 12;
      widths[c] = Math.min(MAX_COLUMN_WIDTH, Math.max(widths[c] ?? 8, length + 2));
    });
  });
  sheet['!ref'] = utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(0, rows.length - 1), c: Math.max(0, columns - 1) },
  });
  sheet['!cols'] = Array.from({ length: columns }, (_, c) => ({ wch: widths[c] ?? 8 }));

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, sheetName);
  const out = writeXLSX(workbook, {
    type: 'array',
    bookType: 'xlsx',
    compression: true,
    // Gemeinsame Zeichenkettentabelle wie in Excel selbst, statt Text direkt in der Zelle
    bookSST: true,
  }) as ArrayBuffer;
  return new Uint8Array(out);
}
