/**
 * Web Worker für „IBAN-Liste prüfen“. Liest die Liste, prüft die gewählte Spalte und schreibt auf
 * Wunsch eine Datei mit zusätzlicher Spalte „IBAN-Prüfung“. Die Liste selbst bleibt unverändert.
 * Bankdaten: vorerst keine (Entscheidung E9); `lookup` bleibt leer.
 */

import { encodeText } from '../../core/csv/encode.ts';
import { toCsv } from '../../core/csv/write.ts';
import { isCsv, isWorkbook } from '../../core/files/classify.ts';
import { guessColumns } from '../../core/sepa/columns.ts';
import { checkIbanValue, summarize, type IbanCheck } from '../../core/sepa/iban-list.ts';
import { writeXlsx, type OutputCell } from '../../core/sheet/write.ts';
import { readTableFile, type TableFile } from '../../core/table/read-file.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';
import type { IbanChecked, IbanExport, IbanRead, IbanRequest } from './iban-types.ts';
import { ibanCheckMessage } from './messages.ts';

export type { IbanRequest };

const LABEL = 'IBAN-Prüfung';
let table: TableFile | null = null;

async function read(file: File): Promise<IbanRead> {
  table = null;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, code: 'unreadable' };
  }
  const result = readTableFile(
    bytes,
    isCsv(file) ? 'csv' : isWorkbook(file) ? 'workbook' : 'other',
  );
  if (!result.ok) return result;
  table = result.table;
  const headers = table.text[0] ?? [];
  return {
    ok: true,
    headers,
    rows: table.text.length - 1,
    sheet: table.sheet,
    guess: guessColumns(headers).iban,
  };
}

function messages(column: number): { checks: IbanCheck[]; texts: string[] } {
  const data = (table?.text ?? []).slice(1);
  const checks = data.map((row) => checkIbanValue(row[column] ?? ''));
  const { repeated } = summarize(checks);
  const linesOf = new Map<string, number[]>();
  for (const [iban, rows] of repeated)
    linesOf.set(
      iban,
      rows.map((r) => r + 2),
    );
  const texts = checks.map((c) =>
    ibanCheckMessage(c, c.status === 'ok' ? (linesOf.get(c.iban) ?? []) : []),
  );
  return { checks, texts };
}

function check(column: number): IbanChecked {
  const data = (table?.text ?? []).slice(1);
  const { checks, texts } = messages(column);
  const s = summarize(checks);
  return {
    rows: checks.map((c, i) => ({
      line: i + 2,
      shown: c.status === 'ok' || c.status === 'non-eea' ? c.formatted : (data[i]?.[column] ?? ''),
      ok: c.status === 'ok',
      bad: c.status === 'error' || (c.status === 'non-eea' && !c.checksumOk),
      message: texts[i] ?? '',
    })),
    ok: s.ok,
    errors: s.errors,
    nonEea: s.nonEea,
    empty: s.empty,
    repeated: s.repeated.size,
  };
}

function exportChecked(column: number): IbanExport {
  if (!table) throw Object.assign(new Error('keine Tabelle'), { code: 'no-source' });
  const { texts } = messages(column);
  const mark = (i: number) => (i === 0 ? LABEL : (texts[i - 1] ?? ''));
  if (table.source === 'csv') {
    const rows = table.text.map((row, i) => [mark(i), ...row]);
    const encoded = encodeText(`${toCsv(rows, table.delimiter)}\r\n`, 'utf-8-bom');
    if (!encoded.ok) throw new Error('UTF-8 kann alles darstellen');
    return { bytes: encoded.bytes, extension: 'csv' };
  }
  const rows: OutputCell[][] = (table.values ?? []).map((row, i) => [
    mark(i),
    ...row.map((v): OutputCell =>
      v === null ? '' : typeof v === 'boolean' ? (v ? 'WAHR' : 'FALSCH') : v,
    ),
  ]);
  return { bytes: writeXlsx(rows), extension: 'xlsx' };
}

serveRequests<IbanRequest>(async (request) => {
  if (request.type === 'read') return { result: await read(request.file) };
  if (request.type === 'check') return { result: check(request.column) };
  const result = exportChecked(request.column);
  return { result, transfer: [result.bytes.buffer as ArrayBuffer] };
});
