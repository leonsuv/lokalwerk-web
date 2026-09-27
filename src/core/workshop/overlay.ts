/**
 * Was die Vorschau einer Seite über das gerenderte Original zeichnet, damit sie so aussieht wie
 * nach dem Speichern: Unterschriften und Stempel (Seiten-Operationen, Stufe 2.2) und die
 * Seitenzahl (Dokument-Operation, Stufe 2.1), in derselben Reihenfolge und mit derselben
 * Geometrie wie assemble.ts. Ohne DOM; gezeichnet wird in
 * src/tools/pdf-werkstatt/overlay-canvas.ts.
 *
 * Koordinaten beziehen sich auf die Seite, wie sie angezeigt wird (mit ihrer ganzen Drehung).
 */

import type { NormRect } from '../geometry/norm-rect.ts';
import { pageNumberFor, pageNumberInView, type PageNumberOptions } from '../pdf/page-numbers.ts';
import { normalizeRotation, type PageRotation } from '../pdf/stamp-geometry.ts';
import { stampInView, type StampInView } from '../pdf/stamp-layout.ts';
import { turnedRect } from './commands.ts';
import { signaturesOf, stampOf, type PageBox, type PageRef, type SignatureImage } from './model.ts';

export type OverlayItem =
  /** Stempel (Helvetica fett) oder Seitenzahl (Helvetica) */
  | ({ kind: 'text'; text: string; bold: boolean } & StampInView)
  | {
      kind: 'image';
      image: SignatureImage;
      /** Rechteck in Anteilen der angezeigten Seite, Ursprung oben links */
      rect: NormRect;
      /** Drehung des Bildes im Uhrzeigersinn um die Mitte des Rechtecks */
      turn: PageRotation;
    };

/** Seitenzahlen des Dokuments und wo die Seite darin steht (ab 0) */
export interface PageNumberPlace {
  options: PageNumberOptions;
  index: number;
  count: number;
}

export interface OverlayOptions {
  /** Unterschriften weglassen (der Dialog zum Platzieren zeigt sie als verschiebbare Rahmen) */
  signatures?: boolean;
  /** Seitenzahl, wenn das Dokument welche hat */
  numbers?: PageNumberPlace | null;
}

/**
 * `view`: Größe der angezeigten Seite in Punkt. `textWidth(text, size, bold)` misst in Helvetica
 * (fett für den Stempel). Erst die Unterschriften, dann der Stempel, zuletzt die Seitenzahl, wie
 * beim Export.
 */
export function pageOverlay(
  page: PageRef,
  view: PageBox,
  textWidth: (text: string, size: number, bold: boolean) => number,
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
      bold: true,
      ...stampInView(view.width, view.height, stamp, (size) => textWidth(stamp.text, size, true)),
    });
  }
  const numbers = options.numbers;
  const text = numbers ? pageNumberFor(numbers.options, numbers.index, numbers.count) : null;
  if (numbers && text !== null) {
    const size = numbers.options.fontSize;
    items.push({
      kind: 'text',
      text,
      bold: false,
      ...pageNumberInView(view.width, view.height, numbers.options, textWidth(text, size, false)),
      angle: 0,
      size,
      rgb: [0, 0, 0],
      opacity: 1,
    });
  }
  return items;
}

/** Hat die Seite etwas, das die Vorschau zusätzlich zeichnen muss? */
export function hasOverlay(page: PageRef, options: OverlayOptions = {}): boolean {
  return (page.ops?.length ?? 0) > 0 || !!options.numbers;
}
