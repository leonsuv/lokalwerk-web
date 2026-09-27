/**
 * Web Worker der PDF-Werkstatt (plan-phase3.md Abschnitt 3). Lädt pdf-lib beim Start, damit die
 * Seite nach dem ersten Anzeigen offline funktioniert (plan.md N4).
 *
 * Der Worker hält je PDF nur die `File` (ein Verweis, keine Kopie der Bytes) und liest sie
 * beim Hinzufügen und beim Export. Bilder werden beim Hinzufügen neu kodiert (ohne Metadaten)
 * und so gehalten. So liegt eine PDF zwischen diesen Schritten nur einmal im
 * Speicher, bei pdf.js für die Vorschau. Der Zustand der Werkstatt bleibt im Hauptthread; der
 * Export bekommt nur Seitenverweise.
 */

import { assemblePdfs, type AssembleDoc, type AssembleSource } from '../../core/pdf/assemble.ts';
import type { PageImage } from '../../core/pdf/from-images.ts';
import { inspectForWorkshop, type WorkshopPdfInfo } from '../../core/pdf/workshop-inspect.ts';
import { prepareImage } from '../../ui/image-prepare.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type WorkshopRequest =
  | { type: 'canvas' }
  | { type: 'add-pdf'; id: string; file: File }
  /** Bild: im Worker neu kodieren (`file`) oder schon auf der Seite vorbereitet (`image`) */
  | { type: 'add-image'; id: string; file: File; jpeg: boolean }
  | { type: 'add-image'; id: string; image: PageImage }
  | { type: 'release'; ids: string[] }
  | { type: 'export'; docs: AssembleDoc[] };

export type AddPdfResult = WorkshopPdfInfo;

/** Größe des neu kodierten Bilds in Pixeln */
export interface AddImageResult {
  width: number;
  height: number;
}

export interface ExportedFile {
  name: string;
  bytes: Uint8Array;
  unchanged: boolean;
}

/** Fortschritt beim Export: fertige und alle Seiten */
export interface ExportProgress {
  done: number;
  total: number;
}

const sources = new Map<
  string,
  { kind: 'pdf'; file: File } | { kind: 'image'; image: PageImage }
>();

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

async function exportDocs(
  docs: AssembleDoc[],
  progress: (value: ExportProgress) => void,
): Promise<ExportedFile[]> {
  const needed = new Set<string>();
  for (const doc of docs) {
    if (doc.original !== undefined) needed.add(doc.original);
    for (const page of doc.pages) if (page.kind === 'source') needed.add(page.source);
  }
  const data = new Map<string, AssembleSource>();
  for (const id of needed) {
    const source = sources.get(id);
    if (!source) throw new WorkerError('unknown-source');
    data.set(
      id,
      source.kind === 'pdf'
        ? { kind: 'pdf', bytes: await readFile(source.file) }
        : { kind: 'image', image: source.image },
    );
  }
  return assemblePdfs(docs, data, (done, total) => progress({ done, total }));
}

serveRequests<WorkshopRequest>(async (request, progress) => {
  switch (request.type) {
    case 'canvas':
      return { result: typeof OffscreenCanvas !== 'undefined' };
    case 'add-image': {
      // Neu kodiert ohne Metadaten der Kamera, wie in „Bilder zu PDF“ (Qualität „original“)
      const image =
        'image' in request
          ? request.image
          : await prepareImage(request.file, request.jpeg, 'original');
      sources.set(request.id, { kind: 'image', image });
      return { result: { width: image.width, height: image.height } satisfies AddImageResult };
    }
    case 'add-pdf': {
      const info = await inspectForWorkshop(await readFile(request.file));
      sources.set(request.id, { kind: 'pdf', file: request.file });
      return { result: info satisfies AddPdfResult };
    }
    case 'release':
      for (const id of request.ids) sources.delete(id);
      return { result: null };
    case 'export': {
      const files = await exportDocs(request.docs, progress);
      return {
        result: files,
        // Übertragen statt kopieren. Zwei unveränderte Kopien derselben Quelle teilen sich
        // einen Puffer; doppelt in der Liste würde postMessage ablehnen.
        transfer: [...new Set(files.map((f) => f.bytes.buffer as ArrayBuffer))],
      };
    }
  }
});
