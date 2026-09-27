/**
 * Seitengröße und Bildplatzierung für Bildseiten, ohne pdf-lib: Die PDF-Werkstatt braucht
 * die Seitengröße einer Bildseite schon im Hauptthread (plan-phase3.md Abschnitt 2), ohne dort
 * pdf-lib zu laden. Aus from-images.ts ausgelagert, das die Namen weiter anbietet.
 *
 * Seitengröße DIN A4 = 210 × 297 mm (ISO 216). PDF misst in Punkt: 1 pt = 1/72 Zoll,
 * also 1 mm = 72 / 25,4 pt (ISO 32000-2, Standardeinheit des Benutzerraums).
 */

export const MM = 72 / 25.4;
export const A4 = { width: 210 * MM, height: 297 * MM };

export type PageLayout = 'a4-auto' | 'a4-portrait' | 'a4-landscape';

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
 * Seite und Bildposition: A4 hoch oder quer (bei „auto“ nach der Bildausrichtung), Bild mit
 * gleichem Seitenverhältnis so groß wie möglich innerhalb des Rands, mittig.
 */
export function placeImage(
  imageWidth: number,
  imageHeight: number,
  layout: PageLayout,
  marginMm: number,
): Placement {
  const landscape = layout === 'a4-landscape' || (layout === 'a4-auto' && imageWidth > imageHeight);
  const pageWidth = landscape ? A4.height : A4.width;
  const pageHeight = landscape ? A4.width : A4.height;
  const margin = Math.max(0, marginMm) * MM;
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
