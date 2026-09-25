/**
 * Web Worker für „Duplikate finden“. Liest CSV (eigener Code) und Excel/ODS (SheetJS), sucht
 * Doppel und schreibt auf Wunsch eine Datei mit zusätzlicher Spalte „Doppelt“. Gelöscht wird nie.
 */

import { decodeText } from '../../core/csv/decode.ts';
import { detectDelimiter } from '../../core/csv/delimiter.ts';
import { encodeText } from '../../core/csv/encode.ts';
import { CsvError, parseCsv, stripSepHint, type Delimiter } from '../../core/csv/parse.ts';
import { toCsv } from '../../core/csv/write.ts';
import { isCsv, isWorkbook } from '../../core/files/classify.ts';
import { formatValue, type SheetValue } from '../../core/sheet/values.ts';
import { writeXlsx, type OutputCell } from '../../core/sheet/write.ts';
import { readSheets, SheetError } from '../../core/sheet/xlsx.ts';
import { findDuplicates, groupNumbers, type DuplicateGroup } from '../../core/table/duplicates.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';
import type { DupExport, DupFound, DupRead, DupRequest } from './dup-types.ts';

export type { DupRequest };

/** Tabelle als Text (für den Vergleich) und im Original (für die Ausgabe) */
let table: {
  text: string[][];
  values: SheetValue[][] | null;
  delimiter: Delimiter;
  source: 'csv' | 'workbook';
} | null = null;
let groups: DuplicateGroup[] = [];

const LABEL = 'Doppelt';

async function read(file: File): Promise<DupRead> {
  table = null;
  groups = [];
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, code: 'unreadable' };
  }
  if (bytes.length === 0) return { ok: false, code: 'empty' };

  if (isCsv(file)) {
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
    table = { text: rows, values: null, delimiter, source: 'csv' };
    return { ok: true, headers: rows[0] ?? [], rows: rows.length - 1, source: 'csv', sheet: null };
  }

  if (!isWorkbook(file)) return { ok: false, code: 'unsupported' };
  try {
    const sheet = readSheets(bytes).find((s) => s.rows.length > 0);
    if (!sheet || sheet.rows.length < 2) return { ok: false, code: 'no-data' };
    const width = Math.max(...sheet.rows.map((r) => r.length));
    const values = sheet.rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null));
    table = {
      text: values.map((r) => r.map((v) => formatValue(v, ','))),
      values,
      delimiter: ';',
      source: 'workbook',
    };
    return {
      ok: true,
      headers: table.text[0] ?? [],
      rows: values.length - 1,
      source: 'workbook',
      sheet: sheet.name,
    };
  } catch (error) {
    if (error instanceof SheetError) return { ok: false, code: error.code };
    throw error;
  }
}

function find(columns: number[]): DupFound {
  if (!table) return { groups: [], affectedRows: 0 };
  const data = table.text.slice(1);
  groups = findDuplicates(data, columns);
  return {
    groups: groups.map((g) => ({
      lines: g.rows.map((r) => r + 2),
      sample: columns.map((c) => data[g.rows[0] ?? 0]?.[c] ?? ''),
    })),
    affectedRows: groups.reduce((sum, g) => sum + g.rows.length, 0),
  };
}

function exportMarked(): DupExport {
  if (!table) throw Object.assign(new Error('keine Tabelle'), { code: 'no-source' });
  const numbers = groupNumbers(table.text.length - 1, groups);
  const mark = (i: number) => (i === 0 ? LABEL : numbers[i - 1] ? String(numbers[i - 1]) : '');
  if (table.source === 'csv') {
    const rows = table.text.map((row, i) => [mark(i), ...row]);
    const encoded = encodeText(`${toCsv(rows, table.delimiter)}\r\n`, 'utf-8-bom');
    if (!encoded.ok) throw new Error('UTF-8 kann alles darstellen');
    return { bytes: encoded.bytes, extension: 'csv' };
  }
  const values = table.values ?? [];
  const rows: OutputCell[][] = values.map((row, i) => [
    mark(i),
    ...row.map((v): OutputCell =>
      v === null ? '' : typeof v === 'boolean' ? (v ? 'WAHR' : 'FALSCH') : v,
    ),
  ]);
  return { bytes: writeXlsx(rows), extension: 'xlsx' };
}

serveRequests<DupRequest>(async (request) => {
  if (request.type === 'read') return { result: await read(request.file) };
  if (request.type === 'find') return { result: find(request.columns) };
  const result = exportMarked();
  return { result, transfer: [result.bytes.buffer as ArrayBuffer] };
});
