/**
 * Web Worker für „Stempel und Wasserzeichen“. Lädt pdf-lib beim Start, damit die Seite nach dem
 * ersten Anzeigen offline funktioniert (plan.md N4).
 */

import {
  addStamp,
  inspectForStamp,
  standardFontCharset,
  type PdfFacts,
  type StampOptions,
} from '../../core/pdf/stamp.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type StampRequest =
  | { type: 'charset' }
  | { type: 'inspect'; file: File }
  | { type: 'stamp'; file: File; options: StampOptions };
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

serveRequests<StampRequest>(async (request) => {
  if (request.type === 'charset') return { result: await standardFontCharset() };
  const bytes = await readFile(request.file);
  if (request.type === 'inspect') return { result: await inspectForStamp(bytes) };
  const out = await addStamp(bytes, request.options);
  return { result: out, transfer: [out.buffer as ArrayBuffer] };
});
