/**
 * Rechteck in Anteilen 0–1 einer angezeigten Seite, Ursprung oben links (Schwärzen, Unterschrift).
 * So passt es zu jeder Vorschaugröße und zur gerasterten Seite.
 */

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Kleinste Kantenlänge, als Anteil der Seite */
export const MIN_SIDE = 0.01;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Hält ein Rechteck innerhalb der Seite, mit Mindestgröße. */
export function fitRect(r: NormRect): NormRect {
  const w = clamp(r.w, MIN_SIDE, 1);
  const h = clamp(r.h, MIN_SIDE, 1);
  return { x: clamp(r.x, 0, 1 - w), y: clamp(r.y, 0, 1 - h), w, h };
}
