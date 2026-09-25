/**
 * Seiten einer PDF in neue PDFs übernehmen (Werkzeug „PDF teilen“). Ohne DOM, läuft im Worker.
 * Wie beim Zusammenfügen werden nur die Seiten übernommen: keine Metadaten, Lesezeichen oder
 * Formular-Definitionen (docs/pdf-lib.md).
 */

import { PDFDocument } from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';
import { pageIndices, type PageRange } from './page-ranges.ts';

/**
 * Eine neue PDF je Gruppe; jede Gruppe ist eine Liste von Bereichen in dieser Reihenfolge.
 * Die Ergebnisse entstehen nacheinander, `onProgress` meldet fertige Dateien.
 */
export async function splitPdf(
  bytes: Uint8Array,
  groups: readonly (readonly PageRange[])[],
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array[]> {
  const source = await loadPdf(bytes);
  const outputs: Uint8Array[] = [];
  try {
    for (const [index, ranges] of groups.entries()) {
      // Ohne Producer/Creator von pdf-lib, siehe docs/pdf-lib.md Nr. 8 und 9.
      const out = await PDFDocument.create({ updateMetadata: false });
      const pages = await out.copyPages(source, ranges.flatMap(pageIndices));
      for (const page of pages) out.addPage(page);
      outputs.push(await out.save());
      onProgress?.(index + 1, groups.length);
    }
  } catch (error) {
    throw toPdfError(error);
  }
  return outputs;
}
