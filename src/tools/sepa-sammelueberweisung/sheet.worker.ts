/**
 * Web Worker für „SEPA-Sammelüberweisung“: liest CSV (eigener Code) und Excel/ODS (SheetJS).
 * Startet beim Öffnen der Seite und lädt dabei SheetJS, damit die Seite danach offline
 * funktioniert (plan.md N4).
 */

import { decodeText } from '../../core/csv/decode.ts';
import { detectDelimiter } from '../../core/csv/delimiter.ts';
import { CsvError, parseCsv, stripSepHint } from '../../core/csv/parse.ts';
import { isCsv } from '../../core/files/classify.ts';
import { readFirstSheet, SheetError } from '../../core/sheet/xlsx.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';
import type { ReadResult } from './read-result.ts';

export interface ReadRequest {
  type: 'read';
  file: File;
}

export type { ReadResult };

async function read(file: File): Promise<ReadResult> {
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
    try {
      return { ok: true, rows: parseCsv(hint.text, delimiter), encoding };
    } catch (error) {
      if (error instanceof CsvError) return { ok: false, code: error.code, line: error.line };
      throw error;
    }
  }

  try {
    return { ok: true, rows: readFirstSheet(bytes), encoding: null };
  } catch (error) {
    if (error instanceof SheetError) return { ok: false, code: error.code };
    throw error;
  }
}

serveRequests<ReadRequest>(async (request) => ({ result: await read(request.file) }));
