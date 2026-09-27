/**
 * Text auf der sichtbaren Seite platzieren (Seitenzahlen, Stempel). Reine Rechnung ohne pdf-lib.
 *
 * ISO 32000-2: Der sichtbare Bereich ist die CropBox (7.7.3.3, Standard: MediaBox); /Rotate dreht
 * die Anzeige im Uhrzeigersinn in Schritten von 90 Grad. Gezeichnet wird aber im ungedrehten
 * Benutzerraum. Diese Datei rechnet eine Position auf der sichtbaren Seite (Ursprung unten
 * links, wie der Leser sie sieht) in Benutzerkoordinaten und Textdrehung um.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PageRotation = 0 | 90 | 180 | 270;

export function normalizeRotation(angle: number): PageRotation {
  const r = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  return r as PageRotation;
}

/** Größe der sichtbaren Seite: bei 90 und 270 Grad sind Breite und Höhe vertauscht. */
export function visibleSize(box: Box, rotation: PageRotation): { width: number; height: number } {
  return rotation === 90 || rotation === 270
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height };
}

/** Punkt auf der sichtbaren Seite → Benutzerraum */
export function toUserSpace(
  box: Box,
  rotation: PageRotation,
  vx: number,
  vy: number,
): { x: number; y: number } {
  switch (rotation) {
    case 0:
      return { x: box.x + vx, y: box.y + vy };
    case 90:
      return { x: box.x + box.width - vy, y: box.y + vx };
    case 180:
      return { x: box.x + box.width - vx, y: box.y + box.height - vy };
    case 270:
      return { x: box.x + vy, y: box.y + box.height - vx };
  }
}

/** Benutzerraum → sichtbare Seite (Umkehrung, für Tests) */
export function toVisible(
  box: Box,
  rotation: PageRotation,
  x: number,
  y: number,
): { vx: number; vy: number } {
  const ux = x - box.x;
  const uy = y - box.y;
  switch (rotation) {
    case 0:
      return { vx: ux, vy: uy };
    case 90:
      return { vx: uy, vy: box.width - ux };
    case 180:
      return { vx: box.width - ux, vy: box.height - uy };
    case 270:
      return { vx: box.height - uy, vy: ux };
  }
}

export type Anchor =
  'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';

export interface Placement {
  /** Anfang der Grundlinie im Benutzerraum */
  x: number;
  y: number;
  /** Textdrehung gegen den Uhrzeigersinn in Grad (für pdf-lib drawText) */
  rotate: number;
}

/** Punkt auf der sichtbaren Seite (Ursprung unten links, in Punkt) */
export interface ViewPoint {
  vx: number;
  vy: number;
}

/**
 * Anfang der Grundlinie eines einzeiligen Texts an einem Rand der sichtbaren Seite
 * (`width` × `height`). `margin` ist der Abstand vom Rand zur Grundlinie (unten) bzw. zur
 * Oberkante der Großbuchstaben (oben), in Punkt.
 */
export function edgeInView(
  width: number,
  height: number,
  anchor: Anchor,
  textWidth: number,
  capHeight: number,
  margin: number,
): ViewPoint {
  const [vertical, horizontal] = anchor.split('-') as ['top' | 'bottom', string];
  const vx =
    horizontal === 'left'
      ? margin
      : horizontal === 'right'
        ? width - margin - textWidth
        : (width - textWidth) / 2;
  const vy = vertical === 'bottom' ? margin : height - margin - capHeight;
  return { vx, vy };
}

/**
 * Einzeiliger Text an einem Rand der sichtbaren Seite, im Benutzerraum (siehe edgeInView).
 */
export function placeAtEdge(
  box: Box,
  rotation: PageRotation,
  anchor: Anchor,
  textWidth: number,
  capHeight: number,
  margin: number,
): Placement {
  const { width, height } = visibleSize(box, rotation);
  const { vx, vy } = edgeInView(width, height, anchor, textWidth, capHeight, margin);
  const point = toUserSpace(box, rotation, vx, vy);
  return { ...point, rotate: rotation };
}

/**
 * Anfang der Grundlinie eines Texts mittig auf der sichtbaren Seite, um `angle` Grad gedreht
 * (gegen den Uhrzeigersinn, wie gelesen). Die Mitte der Zeile (halbe Breite, halbe
 * Versalhöhe) liegt in der Seitenmitte.
 */
export function centeredInView(
  width: number,
  height: number,
  angle: number,
  textWidth: number,
  capHeight: number,
): ViewPoint {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Vom Mittelpunkt der Zeile zurück zum Anfang der Grundlinie, gedreht
  const dx = textWidth / 2;
  const dy = capHeight / 2;
  return { vx: width / 2 - (dx * cos - dy * sin), vy: height / 2 - (dx * sin + dy * cos) };
}

/** Text mittig auf der sichtbaren Seite, im Benutzerraum (siehe centeredInView) */
export function placeCentered(
  box: Box,
  rotation: PageRotation,
  angle: number,
  textWidth: number,
  capHeight: number,
): Placement {
  const { width, height } = visibleSize(box, rotation);
  const { vx, vy } = centeredInView(width, height, angle, textWidth, capHeight);
  const point = toUserSpace(box, rotation, vx, vy);
  return { ...point, rotate: (angle + rotation) % 360 };
}

/** Diagonale der sichtbaren Seite in Grad (von unten links nach oben rechts) */
export function diagonalAngle(box: Box, rotation: PageRotation): number {
  const { width, height } = visibleSize(box, rotation);
  return (Math.atan2(height, width) * 180) / Math.PI;
}
