/**
 * Ränder von PDF-Seiten abschneiden (Werkzeug „PDF zuschneiden“). Ohne DOM, läuft im Worker.
 *
 * Gesetzt wird der sichtbare Bereich der Seite (CropBox, ISO 32000-2, 7.7.3.3). Die Seite
 * bleibt sonst unberührt, deshalb behalten Lesezeichen, Metadaten, Links und Formulare ihre
 * Funktion. Der abgeschnittene Rand steckt weiter in der Datei: Das Werkzeug dient dem Zuschnitt,
 * nicht dem Entfernen von Inhalten (dafür gibt es „PDF schwärzen“). Die Ränder gelten für die
 * Seite, wie sie angezeigt wird, auch bei gedrehten Seiten (/Rotate).
 */

import { PDFDocument } from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';
import { cropBox, type Margins } from './crop-geometry.ts';
import { normalizeRotation } from './stamp-geometry.ts';

export class CropError extends Error {
  readonly code = 'margins-too-large';
  constructor(readonly page: number) {
    super(`Zuschnitt zu groß für Seite ${page}`);
    this.name = 'CropError';
  }
}

/** Schneidet die Seiten `pages` (ab 0; null = alle) zu. Wirft CropError oder PdfError. */
export async function cropPages(
  bytes: Uint8Array,
  margins: Margins,
  pages: readonly number[] | null,
): Promise<Uint8Array> {
  const doc: PDFDocument = await loadPdf(bytes);
  try {
    const all = doc.getPages();
    const chosen = new Set(pages ?? all.keys());
    for (const [i, page] of all.entries()) {
      if (!chosen.has(i)) continue;
      const crop = page.getCropBox();
      const next = cropBox(
        { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
        normalizeRotation(page.getRotation().angle),
        margins,
      );
      if (!next) throw new CropError(i + 1);
      page.setCropBox(next.x, next.y, next.width, next.height);
    }
    return await doc.save();
  } catch (error) {
    if (error instanceof CropError) throw error;
    throw toPdfError(error);
  }
}
