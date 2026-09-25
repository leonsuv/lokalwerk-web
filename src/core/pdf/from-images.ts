/**
 * Bilder als Seiten einer neuen PDF (Werkzeug „Bilder zu PDF“). Ohne DOM, läuft im Worker.
 * Die Bilder kommen schon neu kodiert als JPEG oder PNG an (ohne Metadaten der Originale).
 *
 * Seitengröße DIN A4 = 210 × 297 mm (ISO 216). PDF misst in Punkt: 1 pt = 1/72 Zoll,
 * also 1 mm = 72 / 25,4 pt (ISO 32000-2, Standardeinheit des Benutzerraums).
 */

import { PDFDocument } from 'pdf-lib';
import { toPdfError } from './merge.ts';

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

export async function imagesToPdf(
  images: readonly PageImage[],
  layout: PageLayout,
  marginMm: number,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  try {
    // Ohne Producer/Creator von pdf-lib, siehe docs/pdf-lib.md Nr. 8 und 9.
    const doc = await PDFDocument.create({ updateMetadata: false });
    for (const [index, image] of images.entries()) {
      const embedded =
        image.type === 'image/jpeg'
          ? await doc.embedJpg(image.bytes)
          : await doc.embedPng(image.bytes);
      const place = placeImage(image.width, image.height, layout, marginMm);
      const page = doc.addPage([place.pageWidth, place.pageHeight]);
      page.drawImage(embedded, {
        x: place.x,
        y: place.y,
        width: place.width,
        height: place.height,
      });
      onProgress?.(index + 1, images.length);
    }
    return await doc.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
