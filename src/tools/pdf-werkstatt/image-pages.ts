/**
 * Bildseiten zeichnen (Vorschaubild, große Vorschau): weiße DIN-A4-Seite mit dem Bild, so
 * platziert wie beim Export (imagePagePlacement, 1 cm Rand) und um die zusätzliche Drehung
 * gedreht. Die Ausrichtung nach Exif übernimmt createImageBitmap, wie beim Neu-Kodieren.
 */

import { imagePagePlacement } from '../../core/pdf/image-layout.ts';

/**
 * Bild als ImageBitmap, verkleinert auf etwa `width` Pixel Breite, wenn der Browser das beim
 * Dekodieren kann (spart Speicher und Zeit bei Fotos mit vielen Megapixeln).
 */
export async function decodeImage(file: Blob, width?: number): Promise<ImageBitmap> {
  if (width) {
    try {
      return await createImageBitmap(file, { resizeWidth: width, resizeQuality: 'medium' });
    } catch {
      // Ältere Browser kennen die Optionen nicht: dann in voller Größe
    }
  }
  return createImageBitmap(file);
}

/** Zeichnet die Bildseite in ein neues Canvas mit `pixelWidth` Pixeln Breite */
export function drawImagePage(
  bitmap: ImageBitmap,
  rotate: number,
  pixelWidth: number,
): HTMLCanvasElement {
  const place = imagePagePlacement(bitmap.width, bitmap.height);
  const turned = rotate === 90 || rotate === 270;
  const visibleWidth = turned ? place.pageHeight : place.pageWidth;
  const visibleHeight = turned ? place.pageWidth : place.pageHeight;
  const scale = pixelWidth / visibleWidth;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(visibleWidth * scale));
  canvas.height = Math.max(1, Math.round(visibleHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  // Ungedrehte Seite um den Mittelpunkt; PDF zählt y von unten, das Bild ist mittig.
  const w = place.pageWidth * scale;
  const h = place.pageHeight * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    -w / 2 + place.x * scale,
    -h / 2 + (place.pageHeight - place.y - place.height) * scale,
    place.width * scale,
    place.height * scale,
  );
  return canvas;
}
