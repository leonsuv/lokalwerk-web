/**
 * Seitengröße ändern (Werkzeug „Seitengröße ändern“). Ohne DOM, läuft im Worker.
 *
 * Jede Seite wird als Formular (Form XObject, ISO 32000-2, 8.10) in ein neues Blatt in der
 * Zielgröße eingebettet, wie beim Broschüren- und Mehrfachseiten-Werkzeug. Gezeigt wird der
 * sichtbare Bereich der Seite (CropBox, /Rotate beachtet). Links, Formularfelder und Metadaten
 * gehen dabei verloren, weil nur der Seiteninhalt übernommen wird. Die Maßstäbe und Felder
 * berechnet ./resize-geometry.ts.
 */

import { PDFDocument, degrees } from 'pdf-lib';
import { placeInCell } from './impose.ts';
import { loadPdf, toPdfError } from './merge.ts';
import {
  centeredCell,
  scaleFor,
  targetSize,
  type FitMode,
  type TargetChoice,
} from './resize-geometry.ts';
import { normalizeRotation, visibleSize } from './stamp-geometry.ts';

export class ResizeError extends Error {
  readonly code = 'page-too-small';
  constructor(readonly page: number) {
    super(`Seite ${page} ist zu klein für den Rand`);
    this.name = 'ResizeError';
  }
}

export interface ResizeOptions {
  size: TargetChoice;
  mode: FitMode;
}

/** Setzt jede Seite von `bytes` in die gewählte Größe. Wirft ResizeError oder PdfError. */
export async function resizePages(bytes: Uint8Array, options: ResizeOptions): Promise<Uint8Array> {
  const source = await loadPdf(bytes);
  try {
    const out = await PDFDocument.create({ updateMetadata: false });
    const pages = source.getPages();
    const boxes = pages.map((page) => {
      const c = page.getCropBox();
      return { left: c.x, bottom: c.y, right: c.x + c.width, top: c.y + c.height };
    });
    const embedded = await out.embedPages(pages, boxes);
    for (const [i, page] of pages.entries()) {
      const box = boxes[i];
      const form = embedded[i];
      if (!box || !form) continue;
      const rotation = normalizeRotation(page.getRotation().angle);
      const width = box.right - box.left;
      const height = box.top - box.bottom;
      const visible = visibleSize({ x: 0, y: 0, width, height }, rotation);
      const target = targetSize(options.size, visible);
      const scale = scaleFor(visible, target, options.mode);
      if (scale === null) throw new ResizeError(i + 1);
      const cell = centeredCell(visible, scale, target);
      const place = placeInCell(cell, width, height, rotation);
      const sheet = out.addPage([target.width, target.height]);
      sheet.drawPage(form, {
        x: place.x,
        y: place.y,
        xScale: place.scale,
        yScale: place.scale,
        rotate: degrees(place.rotate),
      });
    }
    return await out.save();
  } catch (error) {
    if (error instanceof ResizeError) throw error;
    throw toPdfError(error);
  }
}
