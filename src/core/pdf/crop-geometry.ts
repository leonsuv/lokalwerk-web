/**
 * Rechnung für „PDF zuschneiden“ ohne pdf-lib, damit auch die Seite im Hauptthread sie nutzen
 * darf (Ränder in Punkt, neuer sichtbarer Bereich im Benutzerraum). Erklärung: ./crop.ts.
 */

import { toUserSpace, visibleSize, type Box, type PageRotation } from './stamp-geometry.ts';

/** Punkt je Millimeter (1 pt = 1/72 Zoll) */
export const POINTS_PER_MM = 72 / 25.4;

/** Ränder in Punkt, bezogen auf die angezeigte Seite */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Kleinste Kantenlänge, die nach dem Zuschnitt übrig bleiben muss (Punkt) */
export const MIN_SIDE = 10;

/** Neuer sichtbarer Bereich im Benutzerraum der Seite; null, wenn nichts Brauchbares bleibt */
export function cropBox(box: Box, rotation: PageRotation, margins: Margins): Box | null {
  const { width, height } = visibleSize(box, rotation);
  const x1 = width - margins.right;
  const y1 = height - margins.top;
  if (x1 - margins.left < MIN_SIDE || y1 - margins.bottom < MIN_SIDE) return null;
  const a = toUserSpace(box, rotation, margins.left, margins.bottom);
  const b = toUserSpace(box, rotation, x1, y1);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
