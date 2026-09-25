/** Web Worker für „CSV reparieren“: große Dateien frieren die Seite so nicht ein. */

import { decodeText } from '../../core/csv/decode.ts';
import { detectDelimiter } from '../../core/csv/delimiter.ts';
import { encodeText } from '../../core/csv/encode.ts';
import { CsvError, parseCsv, stripSepHint } from '../../core/csv/parse.ts';
import {
  analyzeRepairs,
  applyRepairs,
  irregularRows,
  type CellChange,
} from '../../core/csv/repair.ts';
import { toCsv } from '../../core/csv/write.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';
import {
  MAX_LISTED,
  PREVIEW_ROWS,
  type ReadSummary,
  type RepairRequest,
  type SaveResult,
} from './repair-types.ts';

export type { RepairRequest };

let rows: string[][] = [];
let changes: CellChange[] = [];

async function read(file: File): Promise<ReadSummary> {
  rows = [];
  changes = [];
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, code: 'unreadable' };
  }
  if (bytes.length === 0) return { ok: false, code: 'empty' };
  const { text, encoding } = decodeText(bytes);
  const hint = stripSepHint(text);
  const delimiter = hint.delimiter ?? detectDelimiter(hint.text);
  try {
    rows = parseCsv(hint.text, delimiter);
  } catch (error) {
    if (error instanceof CsvError) return { ok: false, code: error.code, line: error.line };
    throw error;
  }
  while (rows.length > 0 && rows.at(-1)?.every((c) => c === '')) rows.pop();
  if (rows.length === 0) return { ok: false, code: 'empty' };
  const analysis = analyzeRepairs(rows);
  changes = analysis.changes;
  return {
    ok: true,
    encoding,
    delimiter,
    rows: rows.length,
    columns: Math.max(...rows.map((r) => r.length)),
    irregular: irregularRows(rows),
    changes: changes.slice(0, MAX_LISTED),
    changeCount: changes.length,
    unsure: analysis.unsure.slice(0, MAX_LISTED),
    unsureCount: analysis.unsure.length,
    preview: applyRepairs(
      rows.slice(0, PREVIEW_ROWS),
      changes.filter((c) => c.row <= PREVIEW_ROWS),
    ),
    previewRaw: rows.slice(0, PREVIEW_ROWS),
    headers: rows[0] ?? [],
  };
}

serveRequests<RepairRequest>(async (request) => {
  if (request.type === 'read') return { result: await read(request.file) };
  const out = request.repair ? applyRepairs(rows, changes) : rows;
  const encoded = encodeText(`${toCsv(out, request.delimiter)}\r\n`, request.encoding);
  const result: SaveResult = encoded.ok
    ? { ok: true, bytes: encoded.bytes, repaired: request.repair ? changes.length : 0 }
    : encoded;
  return { result, transfer: encoded.ok ? [encoded.bytes.buffer as ArrayBuffer] : [] };
});
