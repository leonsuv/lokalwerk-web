/**
 * Bilder als Seiten einer neuen PDF (Werkzeug „Bilder zu PDF“). Ohne DOM, läuft im Worker.
 * Die Bilder kommen schon neu kodiert als JPEG oder PNG an (ohne Metadaten der Originale).
 * Seitengröße und Platzierung: image-layout.ts.
 */

import { PDFDocument } from 'pdf-lib';
import { placeImage, type PageImage, type PageLayout } from './image-layout.ts';
import { toPdfError } from './merge.ts';

export { A4, MM, placeImage } from './image-layout.ts';
export type { PageImage, PageLayout, Placement } from './image-layout.ts';

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
