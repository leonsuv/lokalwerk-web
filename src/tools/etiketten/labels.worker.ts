/**
 * Web Worker für „Etiketten aus einer Liste“. Liest die Liste (CSV mit eigenem Code, Excel/ODS
 * über SheetJS), prüft jede Zeile mit den Schriftmaßen von Helvetica und erzeugt die PDF.
 * Lädt pdf-lib beim Start (plan.md N4).
 */

import { isCsv, isWorkbook } from '../../core/files/classify.ts';
import { labelsPerPage } from '../../core/labels/layout.ts';
import { guessPlan } from '../../core/labels/lines.ts';
import { prepareLabels, type Prepared, type PrepareOptions } from '../../core/labels/prepare.ts';
import { buildLabelsPdf } from '../../core/pdf/labels.ts';
import { readTableFile, type TableFile } from '../../core/table/read-file.ts';
import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import { serveRequests } from '../../ui/worker-protocol.ts';
import type { LabelPrepared, LabelRead, LabelRequest } from './label-types.ts';

export type { LabelRequest };

let table: TableFile | null = null;
let font: Promise<{ font: PDFFont; charset: Set<number> }> | null = null;

/** Helvetica nur zum Messen; die PDF bettet sie selbst ein */
function measuringFont() {
  font ??= (async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    const f = await doc.embedFont(StandardFonts.Helvetica);
    return { font: f, charset: new Set(f.getCharacterSet()) };
  })();
  return font;
}

async function read(file: File): Promise<LabelRead> {
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
    plan: guessPlan(headers),
  };
}

async function prepare(options: PrepareOptions): Promise<Prepared> {
  const { font: f, charset } = await measuringFont();
  const rows = (table?.text ?? []).slice(1);
  return prepareLabels(rows, options, (t) => f.widthOfTextAtSize(t, 1), charset);
}

serveRequests<LabelRequest>(async (request) => {
  if (request.type === 'read') return { result: await read(request.file) };
  const prepared = await prepare(request.options);
  if (request.type === 'prepare') {
    const result: LabelPrepared = {
      count: prepared.labels.length,
      empty: prepared.empty,
      shrunk: prepared.shrunk,
      problems: prepared.problems,
      preview: prepared.labels.slice(0, labelsPerPage(request.options.sheet)),
    };
    return { result };
  }
  const result = await buildLabelsPdf({
    sheet: request.options.sheet,
    labels: prepared.labels,
    start: request.start,
    padding: request.options.padding,
    test: request.test,
  });
  return { result, transfer: [result.buffer as ArrayBuffer] };
});
