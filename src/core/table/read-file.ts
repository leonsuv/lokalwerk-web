/**
 * Tabelle aus einer CSV-, Excel- oder ODS-Datei lesen, erste Tabelle mit Inhalt. Ohne DOM, läuft
 * im Worker. Gleiches Verhalten wie in „Duplikate finden“: CSV mit erkannter Kodierung und
 * erkanntem Trennzeichen, Excel/ODS über SheetJS, leere Zeilen am Ende fallen weg.
 */

import { decodeText } from '../csv/decode.ts';
import { detectDelimiter } from '../csv/delimiter.ts';
import { CsvError, parseCsv, stripSepHint, type Delimiter } from '../csv/parse.ts';
import { formatValue, type SheetValue } from '../sheet/values.ts';
import { readSheets, SheetError } from '../sheet/xlsx.ts';

export interface TableFile {
  /** Zellen als Text, erste Zeile ist die Kopfzeile */
  text: string[][];
  /** Werte im Original (nur Excel/ODS), für die Ausgabe */
  values: SheetValue[][] | null;
  delimiter: Delimiter;
  source: 'csv' | 'workbook';
  sheet: string | null;
}

export type TableReadError =
  | 'empty'
  | 'no-data'
  | 'unterminated-quote'
  | 'encrypted'
  | 'damaged'
  | 'not-spreadsheet'
  | 'unsupported';

export type TableRead =
  { ok: true; table: TableFile } | { ok: false; code: TableReadError; line?: number };

export function readTableFile(bytes: Uint8Array, kind: 'csv' | 'workbook' | 'other'): TableRead {
  if (bytes.length === 0) return { ok: false, code: 'empty' };
  if (kind === 'csv') {
    const { text } = decodeText(bytes);
    const hint = stripSepHint(text);
    const delimiter = hint.delimiter ?? detectDelimiter(hint.text);
    let rows: string[][];
    try {
      rows = parseCsv(hint.text, delimiter);
    } catch (error) {
      if (error instanceof CsvError) return { ok: false, code: error.code, line: error.line };
      throw error;
    }
    while (rows.length > 0 && rows.at(-1)?.every((c) => c === '')) rows.pop();
    if (rows.length < 2) return { ok: false, code: rows.length === 0 ? 'empty' : 'no-data' };
    return { ok: true, table: { text: rows, values: null, delimiter, source: 'csv', sheet: null } };
  }
  if (kind !== 'workbook') return { ok: false, code: 'unsupported' };
  try {
    const sheet = readSheets(bytes).find((s) => s.rows.length > 0);
    if (!sheet || sheet.rows.length < 2) return { ok: false, code: 'no-data' };
    const width = Math.max(...sheet.rows.map((r) => r.length));
    const values = sheet.rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null));
    return {
      ok: true,
      table: {
        text: values.map((r) => r.map((v) => formatValue(v, ','))),
        values,
        delimiter: ';',
        source: 'workbook',
        sheet: sheet.name,
      },
    };
  } catch (error) {
    if (error instanceof SheetError) return { ok: false, code: error.code };
    throw error;
  }
}
