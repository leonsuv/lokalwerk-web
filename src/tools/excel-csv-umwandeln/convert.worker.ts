/**
 * Web Worker für „Excel und CSV umwandeln“. Lädt SheetJS beim Start, damit die Seite danach
 * offline funktioniert (plan.md N4). Die gelesene Tabelle bleibt hier im Speicher; die Seite
 * bekommt nur eine Vorschau.
 */

import { decodeText } from '../../core/csv/decode.ts';
import { detectDelimiter } from '../../core/csv/delimiter.ts';
import { encodeText } from '../../core/csv/encode.ts';
import { CsvError, parseCsv, stripSepHint } from '../../core/csv/parse.ts';
import { toCsv } from '../../core/csv/write.ts';
import { isCsv, isWorkbook } from '../../core/files/classify.ts';
import { convertColumns, formatValue, type SheetValue } from '../../core/sheet/values.ts';
import { writeXlsx } from '../../core/sheet/write.ts';
import { readSheets, SheetError, type SheetData } from '../../core/sheet/xlsx.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';
import {
  PREVIEW_ROWS,
  type ConvertRequest,
  type CsvOutcome,
  type ReadOutcome,
  type SheetSummary,
  type XlsxOutcome,
} from './convert-types.ts';

export type { ConvertRequest };

type Source = { kind: 'workbook'; sheets: SheetData[] } | { kind: 'csv'; rows: string[][] };
let source: Source | null = null;

const summary = (name: string, rows: SheetValue[][]): SheetSummary => ({
  name,
  rows: rows.length,
  columns: Math.max(0, ...rows.map((r) => r.length)),
  preview: rows.slice(0, PREVIEW_ROWS),
});

async function read(file: File): Promise<ReadOutcome> {
  source = null;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, code: 'unreadable' };
  }
  if (bytes.length === 0) return { ok: false, code: 'empty' };

  if (isCsv(file)) {
    const { text, encoding } = decodeText(bytes);
    const hint = stripSepHint(text);
    const delimiter = hint.delimiter ?? detectDelimiter(hint.text);
    let rows: string[][];
    try {
      rows = parseCsv(hint.text, delimiter);
    } catch (error) {
      if (error instanceof CsvError) return { ok: false, code: error.code, line: error.line };
      throw error;
    }
    // Leere letzte Zeile (Zeilenende am Dateiende) ist keine Datenzeile.
    while (rows.length > 0 && rows.at(-1)?.every((c) => c === '')) rows.pop();
    if (rows.length === 0) return { ok: false, code: 'empty' };
    source = { kind: 'csv', rows };
    return { ok: true, kind: 'csv', sheet: summary(file.name, rows), encoding, delimiter };
  }

  if (!isWorkbook(file)) return { ok: false, code: 'unsupported' };
  try {
    const sheets = readSheets(bytes);
    source = { kind: 'workbook', sheets };
    return { ok: true, kind: 'workbook', sheets: sheets.map((s) => summary(s.name, s.rows)) };
  } catch (error) {
    if (error instanceof SheetError) return { ok: false, code: error.code };
    throw error;
  }
}

serveRequests<ConvertRequest>(async (request) => {
  if (request.type === 'read') return { result: await read(request.file) };

  if (request.type === 'to-csv') {
    const sheet = source?.kind === 'workbook' ? source.sheets[request.sheet] : undefined;
    if (!sheet) throw Object.assign(new Error('keine Tabelle'), { code: 'no-source' });
    const text = toCsv(
      sheet.rows.map((row) => row.map((v) => formatValue(v, request.decimal))),
      request.delimiter,
    );
    const encoded = encodeText(`${text}\r\n`, request.encoding);
    const result: CsvOutcome = encoded.ok
      ? { ok: true, bytes: encoded.bytes, rows: sheet.rows.length }
      : encoded;
    return { result, transfer: encoded.ok ? [encoded.bytes.buffer as ArrayBuffer] : [] };
  }

  if (source?.kind !== 'csv') throw Object.assign(new Error('keine CSV'), { code: 'no-source' });
  const converted = request.detect
    ? convertColumns(source.rows, request.decimal)
    : { rows: source.rows, numbers: 0, dates: 0 };
  const bytes = writeXlsx(converted.rows);
  const result: XlsxOutcome = {
    bytes,
    rows: source.rows.length,
    numbers: converted.numbers,
    dates: converted.dates,
  };
  return { result, transfer: [bytes.buffer as ArrayBuffer] };
});
