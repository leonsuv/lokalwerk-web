/**
 * Web Worker für „PDF-Lesezeichen bearbeiten“. Liest die Gliederung der Datei und schreibt die
 * bearbeitete Liste in eine neue PDF. Lädt pdf-lib beim Start, damit die Seite danach offline
 * funktioniert (plan.md N4). Der Worker hält keinen Zustand: Jede Anfrage bringt die Datei mit.
 */

import type { BookmarkEntry } from '../../core/pdf/bookmark-model.ts';
import {
  type BookmarkReadResult,
  readBookmarks,
  writeBookmarks,
} from '../../core/pdf/bookmarks.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type BookmarkRequest =
  { type: 'inspect'; file: File } | { type: 'save'; file: File; entries: BookmarkEntry[] };
export type { BookmarkEntry, BookmarkReadResult };

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

serveRequests<BookmarkRequest>(async (request) => {
  const bytes = await readFile(request.file);
  if (request.type === 'inspect') return { result: await readBookmarks(bytes) };
  const out = await writeBookmarks(bytes, request.entries);
  return { result: out, transfer: [out.buffer as ArrayBuffer] };
});
