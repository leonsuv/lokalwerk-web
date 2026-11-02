/**
 * Web Worker für „Anhänge verwalten“. Liest die Anhänge der PDF und baut die neue Datei aus
 * Entfernen und Hinzufügen. Lädt pdf-lib beim Start, damit die Seite danach offline funktioniert
 * (plan.md N4). Gegenstück zur Seite: ./page.ts.
 */

import { editAttachments, listAttachments } from '../../core/pdf/attachments.ts';
import { readFile } from '../../ui/pdf-worker.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type AttachmentsRequest =
  { type: 'list'; file: File } | { type: 'save'; file: File; remove: number[]; add: File[] };

serveRequests<AttachmentsRequest>(async (request) => {
  const bytes = await readFile(request.file);
  if (request.type === 'list') return { result: await listAttachments(bytes) };

  const add = await Promise.all(
    request.add.map(async (file) => {
      try {
        return {
          name: file.name,
          bytes: await readFile(file),
          ...(file.type ? { mimeType: file.type } : {}),
        };
      } catch {
        throw new WorkerError('unreadable');
      }
    }),
  );
  const out = await editAttachments(bytes, { remove: new Set(request.remove), add });
  return { result: out, transfer: [out.buffer as ArrayBuffer] };
});
