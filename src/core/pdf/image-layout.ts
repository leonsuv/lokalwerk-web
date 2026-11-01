/**
 * Seitengröße und Bildplatzierung für Bildseiten, ohne pdf-lib: Die PDF-Werkstatt braucht
 * die Seitengröße einer Bildseite schon im Hauptthread (plan-phase3.md Abschnitt 2), ohne dort
 * pdf-lib zu laden. Aus from-images.ts ausgelagert, das die Namen weiter anbietet.
 *
 * Seitengrößen: DIN A4 = 210 × 297 mm und DIN A5 = 148 × 210 mm (ISO 216), US Letter = 8,5 × 11 Zoll.
 * PDF misst in Punkt: 1 pt = 1/72 Zoll,
 * also 1 mm = 72 / 25,4 pt (ISO 32000-2, Standardeinheit des Benutzerraums).
 */

export const MM = 72 / 25.4;
export const A4 = { width: 210 * MM, height: 297 * MM };

export const A5 = { width: 148 * MM, height: 210 * MM };
export const LETTER = { width: 8.5 * 72, height: 11 * 72 };

export type PageLayout =
  | 'a4-auto'
  | 'a4-portrait'
  | 'a4-landscape'
  | 'a5-auto'
  | 'letter-auto'
  /** Seite hat das Seitenverhältnis des Bildes, die größere Seite ist so lang wie bei DIN A4 */
  | 'sheet';

export interface PageImage {
  bytes: Uint8Array;
  type: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
}

export interface Placement {
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Seite und Bildposition: A4, A5 oder Letter hoch oder quer (bei „auto“ nach der Bildausrichtung),
 * Bild mit gleichem Seitenverhältnis so groß wie möglich innerhalb des Rands, mittig. Bei „sheet“
 * ist die Seite so groß wie das Bild, mit der größeren Seite wie die lange Seite von DIN A4.
 */
export function placeImage(
  imageWidth: number,
  imageHeight: number,
  layout: PageLayout,
  marginMm: number,
): Placement {
  const margin = Math.max(0, marginMm) * MM;
  if (layout === 'sheet') {
    const longSide = Math.max(imageWidth, imageHeight);
    const scale = A4.height / longSide;
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    return {
      pageWidth: width + 2 * margin,
      pageHeight: height + 2 * margin,
      x: margin,
      y: margin,
      width,
      height,
    };
  }
  const size = layout === 'a5-auto' ? A5 : layout === 'letter-auto' ? LETTER : A4;
  const landscape =
    layout === 'a4-landscape' || (layout !== 'a4-portrait' && imageWidth > imageHeight);
  const pageWidth = landscape ? size.height : size.width;
  const pageHeight = landscape ? size.width : size.height;
  const areaWidth = pageWidth - 2 * margin;
  const areaHeight = pageHeight - 2 * margin;
  const scale = Math.min(areaWidth / imageWidth, areaHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}

/** Rand einer Bildseite in der PDF-Werkstatt: wie die Vorgabe in „Bilder zu PDF“ (1 cm) */
export const IMAGE_MARGIN_MM = 10;

/** Bildseite in der PDF-Werkstatt: DIN A4 nach Bildausrichtung, 1 cm Rand */
export function imagePagePlacement(imageWidth: number, imageHeight: number): Placement {
  return placeImage(imageWidth, imageHeight, 'a4-auto', IMAGE_MARGIN_MM);
}
