/**
 * Bild auf die sichtbare Seite einer bestehenden PDF setzen (plan-phase2.md Werkzeug 10,
 * Unterschrift). Ohne DOM, läuft im Worker. Formulare, Lesezeichen und Metadaten bleiben
 * erhalten; digitale Signaturen werden ungültig (isSigned erkennt sie vorher).
 */

import { degrees, type PDFImage, type PDFPage } from 'pdf-lib';
import type { NormRect } from '../geometry/norm-rect.ts';
import { loadPdf, toPdfError } from './merge.ts';
import {
  normalizeRotation,
  toUserSpace,
  visibleSize,
  type Box,
  type PageRotation,
} from './stamp-geometry.ts';

export interface ImagePlacement {
  /** Ecke unten links des Bildes im Benutzerraum */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Drehung gegen den Uhrzeigersinn in Grad, damit das Bild aufrecht erscheint (pdf-lib) */
  rotate: number;
}

/**
 * Rechteck auf der sichtbaren Seite (Anteile, Ursprung oben links, wie in der Vorschau) → Lage
 * im Benutzerraum. Sichtbar ist die CropBox, gedreht um /Rotate im Uhrzeigersinn
 * (ISO 32000-2, 7.7.3.3); gezeichnet wird im ungedrehten Benutzerraum.
 */
export function placeOnPage(box: Box, rotation: PageRotation, rect: NormRect): ImagePlacement {
  const { width, height } = visibleSize(box, rotation);
  const w = rect.w * width;
  const h = rect.h * height;
  // Untere linke Ecke auf der sichtbaren Seite, Ursprung unten links
  const vx = rect.x * width;
  const vy = (1 - rect.y - rect.h) * height;
  const point = toUserSpace(box, rotation, vx, vy);
  return { ...point, width: w, height: h, rotate: rotation };
}

export interface PlacedImage {
  /** Seite ab 1 */
  page: number;
  rect: NormRect;
}

export async function placeImage(
  bytes: Uint8Array,
  png: Uint8Array,
  placements: readonly PlacedImage[],
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  try {
    const image = await doc.embedPng(png);
    for (const { page, rect } of placements) drawPlacedImage(doc.getPage(page - 1), image, rect);
    return await doc.save();
  } catch (error) {
    throw toPdfError(error);
  }
}

/**
 * Setzt das Bild aufrecht in das Rechteck auf der Seite, wie sie mit `rotation` angezeigt wird
 * (Vorgabe: ihre eigene Drehung). Genutzt vom Werkzeug und beim Export der Werkstatt
 * (assemble.ts, mit der Drehung, in der die Unterschrift gesetzt wurde).
 */
export function drawPlacedImage(
  page: PDFPage,
  image: PDFImage,
  rect: NormRect,
  rotation: PageRotation = normalizeRotation(page.getRotation().angle),
): void {
  const p = placeOnPage(page.getCropBox(), rotation, rect);
  page.drawImage(image, {
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    rotate: degrees(p.rotate),
  });
}
