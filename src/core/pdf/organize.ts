/**
 * Seiten einer PDF umsortieren, drehen und löschen (plan-phase2.md Werkzeug 2). Ohne DOM,
 * läuft im Worker. Sonderfall von assemble.ts mit einer Quelle (plan-phase3.md Schritt 1.2):
 * Die Seiten werden in eine neue PDF übernommen, ohne Metadaten, Lesezeichen,
 * Formular-Definitionen oder Signaturen (docs/pdf-lib.md), auch wenn sich nichts ändert.
 *
 * Drehung: /Rotate der Seite in Schritten von 90 Grad im Uhrzeigersinn (ISO 32000-2, 7.7.3.3).
 */

import { assemblePdfs } from './assemble.ts';
import { loadPdf, PdfError } from './merge.ts';

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
  if (plan.length === 0) {
    // Fehler der Datei (leer, verschlüsselt, beschädigt) haben Vorrang, wie bisher.
    await loadPdf(bytes);
    throw new PdfError('no-pages');
  }
  const [result] = await assemblePdfs(
    [
      {
        name: '',
        pages: plan.map((p) => ({
          kind: 'source',
          source: 'original',
          index: p.source - 1,
          rotate: p.rotate,
        })),
      },
    ],
    new Map([['original', { kind: 'pdf', bytes }]]),
  );
  if (!result) throw new PdfError('no-pages');
  return result.bytes;
}
