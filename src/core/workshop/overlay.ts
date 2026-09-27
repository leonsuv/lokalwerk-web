/**
 * Was die Vorschau einer Seite über das gerenderte Original zeichnet, damit sie so aussieht wie
 * nach dem Speichern: Unterschriften und Stempel (Seiten-Operationen, Stufe 2.2), in derselben
 * Reihenfolge und mit derselben Geometrie wie assemble.ts. Ohne DOM; gezeichnet wird in
 * src/tools/pdf-werkstatt/overlay-canvas.ts.
 *
 * Koordinaten beziehen sich auf die Seite, wie sie angezeigt wird (mit ihrer ganzen Drehung).
 */

import type { NormRect } from '../geometry/norm-rect.ts';
import { normalizeRotation, type PageRotation } from '../pdf/stamp-geometry.ts';
import { stampInView, type StampInView } from '../pdf/stamp-layout.ts';
import { turnedRect } from './commands.ts';
import { signaturesOf, stampOf, type PageBox, type PageRef, type SignatureImage } from './model.ts';

export type OverlayItem =
  | ({ kind: 'text'; text: string } & StampInView)
  | {
      kind: 'image';
      image: SignatureImage;
      /** Rechteck in Anteilen der angezeigten Seite, Ursprung oben links */
      rect: NormRect;
      /** Drehung des Bildes im Uhrzeigersinn um die Mitte des Rechtecks */
      turn: PageRotation;
    };

export interface OverlayOptions {
  /** Unterschriften weglassen (der Dialog zum Platzieren zeigt sie als verschiebbare Rahmen) */
  signatures?: boolean;
}

/**
 * `view`: Größe der angezeigten Seite in Punkt. `textWidth(text, size)` misst in Helvetica fett.
 * Erst die Unterschriften, dann der Stempel, wie beim Export.
 */
export function pageOverlay(
  page: PageRef,
  view: PageBox,
  textWidth: (text: string, size: number) => number,
  options: OverlayOptions = {},
): OverlayItem[] {
  const items: OverlayItem[] = [];
  if (options.signatures !== false) {
    for (const s of signaturesOf(page)) {
      // Gesetzt in der Ansicht mit Drehung `turn`; seitdem um die Differenz weitergedreht
      const by = normalizeRotation(page.rotate - s.turn);
      items.push({ kind: 'image', image: s.image, rect: turnedRect(s.rect, by), turn: by });
    }
  }
  const stamp = stampOf(page);
  if (stamp && stamp.text !== '') {
    items.push({
      kind: 'text',
      text: stamp.text,
      ...stampInView(view.width, view.height, stamp, (size) => textWidth(stamp.text, size)),
    });
  }
  return items;
}

/** Hat die Seite etwas, das die Vorschau zusätzlich zeichnen muss? */
export function hasOverlay(page: PageRef): boolean {
  return (page.ops?.length ?? 0) > 0;
}
