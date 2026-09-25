/**
 * Bild in ein anderes Format umwandeln, in voller Größe (mit Ausrichtung nach Exif). Das
 * Neu-Kodieren übernimmt keine Metadaten; findMetadata prüft jedes Ergebnis. Läuft im Worker
 * (OffscreenCanvas) oder, falls der Browser das nicht kann, auf der Seite.
 */

import type { ImageFormat } from '../../core/images/convert.ts';
import { findMetadata } from '../../core/images/metadata-check.ts';
import { renderToBlob } from '../../ui/canvas.ts';
import { WorkerError } from '../../ui/worker-protocol.ts';

/** Ab dieser Pixelzahl stoßen manche Browser (v. a. Safari auf iOS) an Canvas-Grenzen. */
const LARGE_CANVAS_PIXELS = 16_777_216;

export interface ConvertSettings {
  type: ImageFormat;
  /** 0 bis 1, nur für JPEG und WebP */
  quality: number;
}

/** Kann der Browser dieses Format erzeugen? Manche liefern statt WebP stillschweigend PNG. */
export async function supportsFormat(type: ImageFormat): Promise<boolean> {
  try {
    return (await renderToBlob(1, 1, { type, quality: 0.8 }, () => undefined)).type === type;
  } catch {
    return false;
  }
}

export async function convertImage(file: Blob, settings: ConvertSettings): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new WorkerError('decode');
  }
  const { width, height } = bitmap;
  let blob: Blob;
  try {
    blob = await renderToBlob(width, height, settings, (ctx) => {
      if (settings.type === 'image/jpeg') {
        // JPEG kennt keine Transparenz: transparente Bereiche weiß statt schwarz.
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(bitmap, 0, 0);
    });
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw new WorkerError(width * height > LARGE_CANVAS_PIXELS ? 'too-large' : 'encode');
  } finally {
    bitmap.close();
  }
  if (blob.type !== settings.type) throw new WorkerError('format-unsupported');
  if (findMetadata(new Uint8Array(await blob.arrayBuffer())).length > 0) {
    throw new WorkerError('metadata');
  }
  return blob;
}
