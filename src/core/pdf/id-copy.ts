/**
 * Ausweiskopie als PDF: Vorder- und Rückseite untereinander auf einer DIN-A4-Seite
 * (plan-phase2.md Vorschlag A). Ohne DOM, läuft im Worker. Die Bilder kommen fertig geschwärzt
 * und mit Aufdruck; nichts sonst gelangt in die Datei.
 */

import { PDFDocument } from 'pdf-lib';
import { PdfError, toPdfError } from './merge.ts';

/** DIN A4 hoch in Punkt (ISO 216: 210 × 297 mm) */
export const A4 = { width: 595.28, height: 841.89 };
const MM = 72 / 25.4;
/** Rand 20 mm, Abstand zwischen den Seiten 10 mm */
const MARGIN = 20 * MM;
const GAP = 10 * MM;
/** Bilder höchstens drei Viertel der nutzbaren Breite (etwa 128 mm), nicht über die ganze Seite */
const MAX_WIDTH_SHARE = 0.75;

export interface IdImage {
  jpeg: Uint8Array;
  /** Pixelgröße, für das Seitenverhältnis */
  width: number;
  height: number;
}

export interface Placed {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Lage der Bilder auf der Seite: gleiche Breite, zusammen höchstens so hoch wie die Seite */
export function layoutIdPage(images: readonly { width: number; height: number }[]): Placed[] {
  const maxWidth = A4.width - 2 * MARGIN;
  const maxHeight = A4.height - 2 * MARGIN - GAP * Math.max(0, images.length - 1);
  // Jede Seite zunächst auf volle Breite, dann gemeinsam verkleinern, bis alles passt
  const heights = images.map((i) => (maxWidth * i.height) / i.width);
  const total = heights.reduce((a, b) => a + b, 0);
  const scale = Math.min(MAX_WIDTH_SHARE, maxHeight / total);
  let top = A4.height - MARGIN;
  return heights.map((full) => {
    const width = maxWidth * scale;
    const height = full * scale;
    top -= height;
    const placed = { x: (A4.width - width) / 2, y: top, width, height };
    top -= GAP;
    return placed;
  });
}

export async function buildIdCopyPdf(images: readonly IdImage[]): Promise<Uint8Array> {
  if (images.length === 0) throw new PdfError('no-pages');
  try {
    // Ohne Producer/Creator und ohne Info-Einträge (docs/pdf-lib.md Nr. 8 und 9)
    const doc = await PDFDocument.create({ updateMetadata: false });
    const page = doc.addPage([A4.width, A4.height]);
    const places = layoutIdPage(images);
    for (const [i, img] of images.entries()) {
      const embedded = await doc.embedJpg(img.jpeg);
      const p = places[i];
      if (p) page.drawImage(embedded, p);
    }
    return await doc.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
