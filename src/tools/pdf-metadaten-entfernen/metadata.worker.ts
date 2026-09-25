/**
 * Web Worker für „PDF-Metadaten entfernen“. Lädt pdf-lib beim Start, damit die Seite nach dem
 * ersten Anzeigen offline funktioniert (plan.md N4). Nach dem Entfernen wird das Ergebnis
 * noch einmal geprüft und nur angeboten, wenn nichts mehr gefunden wird.
 */

import { inspectPdf, stripPdfMetadata, type PdfInspection } from '../../core/pdf/metadata.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type MetadataRequest = { type: 'inspect'; file: File } | { type: 'strip'; file: File };
export type { PdfInspection };

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

serveRequests<MetadataRequest>(async (request) => {
  const bytes = await readFile(request.file);
  if (request.type === 'inspect') return { result: await inspectPdf(bytes) };
  const stripped = await stripPdfMetadata(bytes);
  const check = await inspectPdf(stripped);
  if (
    check.info.length > 0 ||
    check.xmpBytes !== null ||
    check.attachments > 0 ||
    check.javascript ||
    check.pagesWithMetadata > 0 ||
    check.earlierVersions > 0
  ) {
    throw new WorkerError('metadata-left');
  }
  return { result: stripped, transfer: [stripped.buffer as ArrayBuffer] };
});
