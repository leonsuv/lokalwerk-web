/**
 * Seiten einer PDF in zwei Hälften teilen (Werkzeug „PDF-Seiten halbieren“), etwa Doppelseiten
 * aus dem Scanner. Ohne DOM, läuft im Worker.
 *
 * Jede Seite wird zweimal übernommen, die Hälften unterscheiden sich nur im sichtbaren Bereich
 * (CropBox, ISO 32000-2, 7.7.3.3). Text, Schriften und Links bleiben dadurch erhalten. Die
 * Teilung gilt für die Seite, wie sie angezeigt wird, auch bei gedrehten Seiten (/Rotate).
 * Die andere Hälfte steckt weiter in der Seite: Das Werkzeug dient dem Aufteilen, nicht dem
 * Entfernen von Inhalten (dafür gibt es „PDF schwärzen“).
 */

import { PDFDocument } from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';
import {
  normalizeRotation,
  toUserSpace,
  visibleSize,
  type Box,
  type PageRotation,
} from './stamp-geometry.ts';

/** vertical: links, dann rechts (Doppelseite im Querformat); horizontal: oben, dann unten */
export type HalveDirection = 'vertical' | 'horizontal';

/** Sichtbarer Ausschnitt in Anteilen der angezeigten Seite, Ursprung unten links */
interface VisibleRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Die beiden Hälften in Lesereihenfolge */
export function halves(direction: HalveDirection): [VisibleRect, VisibleRect] {
  return direction === 'vertical'
    ? [
        { x0: 0, y0: 0, x1: 0.5, y1: 1 },
        { x0: 0.5, y0: 0, x1: 1, y1: 1 },
      ]
    : [
        { x0: 0, y0: 0.5, x1: 1, y1: 1 },
        { x0: 0, y0: 0, x1: 1, y1: 0.5 },
      ];
}

/** Ausschnitt der angezeigten Seite als Rechteck im Benutzerraum der Seite */
export function userRect(box: Box, rotation: PageRotation, rect: VisibleRect): Box {
  const { width, height } = visibleSize(box, rotation);
  const a = toUserSpace(box, rotation, rect.x0 * width, rect.y0 * height);
  const b = toUserSpace(box, rotation, rect.x1 * width, rect.y1 * height);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export async function halvePages(
  bytes: Uint8Array,
  direction: HalveDirection,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const source = await loadPdf(bytes);
  try {
    const out = await PDFDocument.create({ updateMetadata: false });
    const total = source.getPageCount();
    const [first, second] = halves(direction);
    for (let i = 0; i < total; i++) {
      const [a, b] = await out.copyPages(source, [i, i]);
      if (!a || !b) continue;
      for (const [page, rect] of [
        [a, first],
        [b, second],
      ] as const) {
        const crop = page.getCropBox();
        const box: Box = { x: crop.x, y: crop.y, width: crop.width, height: crop.height };
        const part = userRect(box, normalizeRotation(page.getRotation().angle), rect);
        page.setCropBox(part.x, part.y, part.width, part.height);
        out.addPage(page);
      }
      onProgress?.(i + 1, total);
    }
    return await out.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
