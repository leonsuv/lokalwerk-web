/**
 * Eine Seite der Werkstatt in ein Canvas zeichnen, so wie sie angezeigt wird (mit Drehung):
 * PDF-Seite über pdf.js, Bildseite, Leerseite. Gemeinsam für die große Vorschau (preview.ts)
 * und das Platzieren einer Unterschrift (sign-dialog.ts). Wirft, wenn es nicht geht.
 */

import { visiblePageSize, type PageRef, type WorkshopState } from '../../core/workshop/model.ts';
import { decodeImage, drawImagePage } from './image-pages.ts';
import type { SourceFiles } from './sources.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

/** `pixels`: Breite in Gerätepixeln */
export async function drawWorkshopPage(
  state: WorkshopState,
  page: PageRef,
  files: SourceFiles,
  pdfjs: Promise<PdfJs>,
  pixels: number,
): Promise<HTMLCanvasElement> {
  const size = visiblePageSize(state, page);
  if (page.kind === 'blank') {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(pixels);
    canvas.height = Math.round((pixels * size.height) / size.width);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }
  if (state.sources.get(page.source)?.kind === 'image') {
    const file = files.file(page.source);
    if (!file) throw new Error('Datei fehlt');
    const bitmap = await decodeImage(file);
    try {
      return drawImagePage(bitmap, page.rotate, pixels);
    } finally {
      bitmap.close();
    }
  }
  const [{ pageSize, renderPageAt }, pdf] = await Promise.all([pdfjs, files.pdf(page.source)]);
  const real = await pageSize(pdf, page.index + 1, page.rotate);
  return renderPageAt(pdf, page.index + 1, {
    scale: pixels / real.width,
    extraRotation: page.rotate,
  });
}
