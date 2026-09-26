/**
 * Web Worker für „PDF-Seiten bearbeiten“. Lädt pdf-lib beim Start, damit die Seite nach dem
 * ersten Anzeigen offline funktioniert (plan.md N4). Die Vorschau zeichnet pdf.js.
 */

import { countPages } from '../../core/pdf/merge.ts';
import { organizePdf, type PagePlan } from '../../core/pdf/organize.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type OrganizeRequest =
  { type: 'inspect'; file: File } | { type: 'organize'; file: File; plan: PagePlan[] };

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

serveRequests<OrganizeRequest>(async (request) => {
  const bytes = await readFile(request.file);
  if (request.type === 'inspect') return { result: await countPages(bytes) };
  const result = await organizePdf(bytes, request.plan);
  return { result, transfer: [result.buffer as ArrayBuffer] };
});
