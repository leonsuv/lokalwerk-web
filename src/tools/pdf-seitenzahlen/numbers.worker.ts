/**
 * Web Worker für „Seitenzahlen einfügen“. Lädt pdf-lib beim Start, damit die Seite nach dem
 * ersten Anzeigen offline funktioniert (plan.md N4).
 */

import {
  addPageNumbers,
  inspectForStamp,
  type PageNumberOptions,
  type PdfFacts,
} from '../../core/pdf/stamp.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type NumbersRequest =
  { type: 'inspect'; file: File } | { type: 'number'; file: File; options: PageNumberOptions };
export type { PdfFacts };

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

serveRequests<NumbersRequest>(async (request) => {
  const bytes = await readFile(request.file);
  if (request.type === 'inspect') return { result: await inspectForStamp(bytes) };
  const out = await addPageNumbers(bytes, request.options);
  return { result: out, transfer: [out.buffer as ArrayBuffer] };
});
