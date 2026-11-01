/**
 * Web Worker für „Vorder- und Rückseiten mischen“. Lädt pdf-lib beim Start (plan.md N4).
 */

import { countPages } from '../../core/pdf/merge.ts';
import { interleavePdfs } from '../../core/pdf/interleave.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type InterleaveRequest =
  { type: 'inspect'; file: File } | { type: 'run'; front: File; back: File; reverseBack: boolean };

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

serveRequests<InterleaveRequest>(async (request) => {
  if (request.type === 'inspect') return { result: await countPages(await readFile(request.file)) };
  const bytes = await interleavePdfs(
    await readFile(request.front),
    await readFile(request.back),
    request.reverseBack,
  );
  return { result: bytes, transfer: [bytes.buffer as ArrayBuffer] };
});
