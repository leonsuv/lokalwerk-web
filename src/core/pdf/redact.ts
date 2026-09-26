/**
 * Geschwärzte PDF aus gerasterten Seiten bauen (plan-phase2.md Werkzeug 5). Ohne DOM, läuft im
 * Worker. Die Funktion bekommt nur fertige Bilder und Seitengrößen, nie die Original-PDF: Nichts
 * aus dem Original (Text, Schriften, Metadaten, Formularfelder, Anhänge, Ebenen, Kommentare)
 * kann in das Ergebnis gelangen. Die Seiten zeichnet und schwärzt die Werkzeugseite mit pdf.js.
 */

import { PDFDocument } from 'pdf-lib';
import { PdfError, toPdfError } from './merge.ts';

export interface RasterPage {
  /** JPEG der ganzen Seite, Schwärzungen schon eingezeichnet */
  jpeg: Uint8Array;
  /** Seitengröße in Punkt, wie angezeigt (Drehung schon angewandt) */
  width: number;
  height: number;
}

export async function buildRasterPdf(pages: readonly RasterPage[]): Promise<Uint8Array> {
  if (pages.length === 0) throw new PdfError('no-pages');
  try {
    // Ohne Producer/Creator und ohne Info-Einträge (docs/pdf-lib.md Nr. 8 und 9).
    const out = await PDFDocument.create({ updateMetadata: false });
    for (const page of pages) {
      const image = await out.embedJpg(page.jpeg);
      const target = out.addPage([page.width, page.height]);
      target.drawImage(image, { x: 0, y: 0, width: page.width, height: page.height });
    }
    return await out.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
