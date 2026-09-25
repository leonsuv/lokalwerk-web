/**
 * Web Worker für „PDF teilen“. Lädt pdf-lib beim Start, damit die Seite nach dem ersten
 * Anzeigen offline funktioniert (plan.md N4). Bekannte Grenzen: docs/pdf-lib.md.
 */

import { countPages } from '../../core/pdf/merge.ts';
import type { PageRange } from '../../core/pdf/page-ranges.ts';
import { splitPdf } from '../../core/pdf/split.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type SplitRequest =
  { type: 'inspect'; file: File } | { type: 'split'; file: File; groups: PageRange[][] };

export interface SplitProgress {
  done: number;
  total: number;
}

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

serveRequests<SplitRequest>(async (request, progress) => {
  const bytes = await readFile(request.file);
  if (request.type === 'inspect') return { result: await countPages(bytes) };
  const outputs = await splitPdf(bytes, request.groups, (done, total) =>
    progress({ done, total } satisfies SplitProgress),
  );
  return { result: outputs, transfer: outputs.map((o) => o.buffer as ArrayBuffer) };
});
