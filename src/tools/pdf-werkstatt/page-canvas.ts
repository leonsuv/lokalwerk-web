/**
 * Eine Seite der Werkstatt in ein Canvas zeichnen, so wie sie angezeigt wird (mit Drehung):
 * PDF-Seite über pdf.js, Bildseite, Leerseite, darüber Stempel und Unterschriften
 * (overlay-canvas.ts). Gemeinsam für die große Vorschau (preview.ts) und das Platzieren einer
 * Unterschrift (sign-dialog.ts). Wirft, wenn es nicht geht.
 */

import type { OverlayOptions } from '../../core/workshop/overlay.ts';
import {
  visiblePageSize,
  type PageBox,
  type PageRef,
  type WorkshopState,
} from '../../core/workshop/model.ts';
import { decodeImage, drawImagePage } from './image-pages.ts';
import { drawOverlay } from './overlay-canvas.ts';
import type { SourceFiles } from './sources.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

export interface DrawOptions extends OverlayOptions {
  /** Hintergrund für PDF-Seiten statt durchsichtig (für JPEG beim Schwärzen) */
  background?: string;
}

const MAX_WIDTH = 720;
/** Untergrenze beim Einpassen in die Höhe */
const MIN_WIDTH = 360;
/** Innenabstand oben und unten der Fläche in den Dialogen (0,2 rem + 0,8 rem), dazu Rahmen */
const STAGE_PADDING = 24;

/**
 * Breite in CSS-Pixeln für eine Seite in einem Dialog (Unterschrift, Schwärzen): die ganze Seite
 * sichtbar, damit man sieht, wo man etwas setzt; auf sehr niedrigen Fenstern nicht schmaler als
 * MIN_WIDTH (dann scrollt die Fläche). `stage` hat eine max-height.
 */
export function dialogPageWidth(stage: HTMLElement, size: PageBox): number {
  const byWidth =
    Math.min(MAX_WIDTH, stage.getBoundingClientRect().width || MAX_WIDTH) / size.width;
  const maxHeight = parseFloat(getComputedStyle(stage).maxHeight) - STAGE_PADDING;
  const byHeight = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight / size.height : byWidth;
  const fit = Math.min(byWidth, Math.max(byHeight, MIN_WIDTH / size.width));
  return Math.max(1, Math.floor(size.width * fit));
}

/** `pixels`: Breite in Gerätepixeln */
export async function drawWorkshopPage(
  state: WorkshopState,
  page: PageRef,
  files: SourceFiles,
  pdfjs: Promise<PdfJs>,
  pixels: number,
  options: DrawOptions = {},
): Promise<HTMLCanvasElement> {
  const size = visiblePageSize(state, page);
  const canvas = await drawBase(state, page, files, pdfjs, pixels, options.background);
  try {
    await drawOverlay(canvas, page, size, options);
  } catch (error) {
    canvas.width = 0;
    canvas.height = 0;
    throw error;
  }
  return canvas;
}

async function drawBase(
  state: WorkshopState,
  page: PageRef,
  files: SourceFiles,
  pdfjs: Promise<PdfJs>,
  pixels: number,
  background: string | undefined,
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
    ...(background ? { background } : {}),
  });
}
