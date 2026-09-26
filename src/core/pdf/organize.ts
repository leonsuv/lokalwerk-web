/**
 * Seiten einer PDF umsortieren, drehen und löschen (plan-phase2.md Werkzeug 2). Ohne DOM,
 * läuft im Worker. Wie beim Teilen werden die Seiten in eine neue PDF übernommen: keine
 * Metadaten, Lesezeichen, Formular-Definitionen oder Signaturen (docs/pdf-lib.md).
 *
 * Drehung: /Rotate der Seite in Schritten von 90 Grad im Uhrzeigersinn (ISO 32000-2, 7.7.3.3).
 */

import { degrees, PDFDocument } from 'pdf-lib';
import { loadPdf, PdfError, toPdfError } from './merge.ts';
import { normalizeRotation } from './stamp-geometry.ts';

export interface PagePlan {
  /** Seite im Original, ab 1 */
  source: number;
  /** Zusätzliche Drehung im Uhrzeigersinn: 0, 90, 180 oder 270 */
  rotate: number;
}

export async function organizePdf(
  bytes: Uint8Array,
  plan: readonly PagePlan[],
): Promise<Uint8Array> {
  const source = await loadPdf(bytes);
  const count = source.getPageCount();
  if (plan.length === 0) throw new PdfError('no-pages');
  for (const p of plan) {
    if (!Number.isInteger(p.source) || p.source < 1 || p.source > count) {
      throw new RangeError(`Seite ${p.source} gibt es nicht`);
    }
  }
  try {
    const out = await PDFDocument.create({ updateMetadata: false });
    const pages = await out.copyPages(
      source,
      plan.map((p) => p.source - 1),
    );
    for (const [i, page] of pages.entries()) {
      const extra = plan[i]?.rotate ?? 0;
      if (extra % 360 !== 0) {
        page.setRotation(degrees(normalizeRotation(page.getRotation().angle + extra)));
      }
      out.addPage(page);
    }
    return await out.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
