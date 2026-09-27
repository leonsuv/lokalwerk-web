/**
 * Schwärzen in der Werkstatt (Stufe 2.3, „Einbacken“): Jede Seite des Dokuments wird so
 * gezeichnet, wie sie angezeigt wird, die Bereiche werden schwarz gefüllt, und der Worker baut
 * aus den Bildern eine neue PDF (core/pdf/redact.ts, wie im Einzelwerkzeug). Der Worker liest
 * dafür die Originaldatei nicht. Die neue PDF wird eine eigene Quelle; der Befehl bakePages
 * setzt das Dokument darauf um.
 *
 * Gerastert wird das ganze Dokument, auch Seiten ohne Bereich: So enthält der Export dieses
 * Dokuments garantiert nichts aus dem Original (Text, Schriften, Metadaten, Formularfelder).
 * Stempel und Unterschriften bleiben Seiten-Operationen und kommen beim Speichern darüber.
 */

import { rasterSize } from '../../core/pdf/raster.ts';
import type { RasterPage } from '../../core/pdf/redact.ts';
import type { BakedPage } from '../../core/workshop/commands.ts';
import {
  visiblePageSize,
  type Doc,
  type PageRef,
  type Source,
  type SourceId,
  type WorkshopState,
} from '../../core/workshop/model.ts';
import type { WorkerClient } from '../../ui/worker-protocol.ts';
import { drawWorkshopPage } from './page-canvas.ts';
import type { RedactAreas } from './redact-dialog.ts';
import type { SourceFiles } from './sources.ts';
import { redactedName } from './texts.ts';
import type { BakedResult, WorkshopRequest } from './workshop.worker.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

export interface RedactedDoc {
  source: Source;
  pages: BakedPage[];
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('encode'));
          return;
        }
        blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
      },
      'image/jpeg',
      0.9,
    ),
  );
}

/** Seite ohne Operationen: gerastert wird nur der Inhalt */
function base(page: PageRef): PageRef {
  const { ops: _ops, ...rest } = page;
  return rest;
}

/**
 * Rastert das Dokument `doc` aus dem Zustand `state` und legt die geschwärzte PDF als neue
 * Quelle `id` im Worker und in `files` an. `progress(n, total)` nach jeder Seite.
 */
export async function redactDoc(
  state: WorkshopState,
  doc: Doc,
  areas: RedactAreas,
  dpi: number,
  deps: {
    id: SourceId;
    files: SourceFiles;
    pdfjs: Promise<PdfJs>;
    client: WorkerClient<WorkshopRequest>;
  },
  progress: (done: number, total: number) => void,
): Promise<RedactedDoc> {
  const pages: RasterPage[] = [];
  for (const [n, page] of doc.pages.entries()) {
    progress(n, doc.pages.length);
    const size = visiblePageSize(state, page);
    const target = rasterSize(size.width, size.height, dpi);
    const canvas = await drawWorkshopPage(state, base(page), deps.files, deps.pdfjs, target.width, {
      background: '#ffffff',
    });
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#000000';
      const W = canvas.width;
      const H = canvas.height;
      for (const r of areas.get(page.key) ?? []) {
        // Nach außen runden, damit kein Pixelrand des Inhalts stehen bleibt
        const x0 = Math.floor(r.x * W);
        const y0 = Math.floor(r.y * H);
        ctx.fillRect(x0, y0, Math.ceil((r.x + r.w) * W) - x0, Math.ceil((r.y + r.h) * H) - y0);
      }
      pages.push({ jpeg: await canvasToJpeg(canvas), width: size.width, height: size.height });
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
  progress(doc.pages.length, doc.pages.length);
  const name = redactedName(doc.name);
  const { file, info } = await deps.client.request<BakedResult>({
    type: 'redact',
    id: deps.id,
    name,
    pages,
  });
  deps.files.add(deps.id, file);
  const from = [...new Set(doc.pages.flatMap((p) => (p.kind === 'source' ? [p.source] : [])))];
  return {
    source: {
      id: deps.id,
      kind: 'pdf',
      name,
      size: file.size,
      ...info,
      origin: { kind: 'redacted', from },
    },
    pages: doc.pages.map((page, index) => ({ key: page.key, before: page, index, rotate: 0 })),
  };
}
