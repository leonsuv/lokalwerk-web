/**
 * Zuschneiden, Drehen (90-Grad-Schritte) und Spiegeln als reine Geometrie (plan-phase2.md 13).
 * Das Rechteck liegt auf dem gedrehten und gespiegelten Bild, als Anteil 0–1 (NormRect).
 */

import type { NormRect } from '../geometry/norm-rect.ts';

export type QuarterTurn = 0 | 90 | 180 | 270;

export interface Transform {
  /** Drehung im Uhrzeigersinn */
  rotate: QuarterTurn;
  /** Waagerecht spiegeln, nach dem Drehen */
  flip: boolean;
}

export function turn(current: QuarterTurn, by: 90 | -90): QuarterTurn {
  return ((((current + by) % 360) + 360) % 360) as QuarterTurn;
}

/** Größe nach dem Drehen */
export function rotatedSize(
  width: number,
  height: number,
  rotate: QuarterTurn,
): { width: number; height: number } {
  return rotate === 90 || rotate === 270 ? { width: height, height: width } : { width, height };
}

/** Pixelrechteck im gedrehten Bild, auf ganze Pixel nach außen gerundet und begrenzt */
export function cropPixels(
  rect: NormRect,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const x0 = Math.max(0, Math.floor(rect.x * width));
  const y0 = Math.max(0, Math.floor(rect.y * height));
  const x1 = Math.min(width, Math.ceil((rect.x + rect.w) * width));
  const y1 = Math.min(height, Math.ceil((rect.y + rect.h) * height));
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

/**
 * Wie cropPixels, aber mit genau dem Seitenverhältnis `ratio` (Breite/Höhe): Die Höhe folgt aus
 * der gerundeten Breite, damit etwa ein Quadrat wirklich quadratisch wird.
 */
export function cropPixelsExact(
  rect: NormRect,
  width: number,
  height: number,
  ratio: number | null,
): { x: number; y: number; width: number; height: number } {
  const px = cropPixels(rect, width, height);
  if (ratio === null) return px;
  let w = Math.round(rect.w * width);
  let h = Math.round(w / ratio);
  if (h > height - px.y) {
    h = height - px.y;
    w = Math.round(h * ratio);
  }
  w = Math.max(1, Math.min(w, width - px.x));
  return { x: px.x, y: px.y, width: w, height: Math.max(1, h) };
}

/**
 * Größtes Rechteck mit Seitenverhältnis `ratio` (Breite/Höhe in Pixeln), mittig im Bild.
 * `null` heißt frei: das ganze Bild.
 */
export function centeredRect(ratio: number | null, width: number, height: number): NormRect {
  if (ratio === null) return { x: 0, y: 0, w: 1, h: 1 };
  const byWidth = width / ratio <= height;
  const w = byWidth ? 1 : (height * ratio) / width;
  const h = byWidth ? width / ratio / height : 1;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/**
 * Canvas-Transformation, die das Originalbild gedreht und gespiegelt auf eine Fläche der
 * gedrehten Größe zeichnet: [a, b, c, d, e, f] für ctx.setTransform.
 */
export function drawMatrix(
  width: number,
  height: number,
  { rotate, flip }: Transform,
): [number, number, number, number, number, number] {
  const out = rotatedSize(width, height, rotate);
  // Drehung
  let m: [number, number, number, number, number, number];
  switch (rotate) {
    case 0:
      m = [1, 0, 0, 1, 0, 0];
      break;
    case 90:
      m = [0, 1, -1, 0, height, 0];
      break;
    case 180:
      m = [-1, 0, 0, -1, width, height];
      break;
    case 270:
      m = [0, -1, 1, 0, 0, width];
      break;
  }
  if (!flip) return m;
  // Danach waagerecht spiegeln: x' = out.width − x
  const [a, b, c, d, e, f] = m;
  return [-a, b, -c, d, out.width - e, f];
}
