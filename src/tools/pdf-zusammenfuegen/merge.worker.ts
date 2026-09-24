/**
 * Web Worker für „PDFs zusammenfügen“. Lädt pdf-lib beim Start, damit die Seite nach dem
 * ersten Anzeigen offline funktioniert (plan.md N4). Bekannte Grenzen: docs/pdf-lib.md.
 */

import { countPages, mergePdfs, type MergeResult } from '../../core/pdf/merge.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type MergeRequest = { type: 'inspect'; file: File } | { type: 'merge'; files: File[] };
export interface MergeProgress {
  done: number;
  total: number;
}
export type { MergeResult };

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    // Speicher reicht nicht, oder die Datei wurde seit dem Auswählen verschoben/gelöscht.
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

serveRequests<MergeRequest>(async (request, progress) => {
  if (request.type === 'inspect') {
    return { result: await countPages(await readFile(request.file)) };
  }
  const result = await mergePdfs(
    request.files.map((file) => () => readFile(file)),
    (done, total) => progress({ done, total } satisfies MergeProgress),
  );
  return { result, transfer: [result.bytes.buffer as ArrayBuffer] };
});
