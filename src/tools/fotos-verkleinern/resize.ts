/**
 * Foto dekodieren, verkleinern, neu kodieren und das Ergebnis auf Metadaten prüfen.
 * Läuft im Worker (OffscreenCanvas) und, falls der Browser das nicht kann, auf der Seite.
 * Das Neu-Kodieren über ein Canvas übernimmt keine Metadaten; findMetadata prüft das.
 */

import { findMetadata } from '../../core/images/metadata-check.ts';
import { targetSize, type OutputType } from '../../core/images/resize.ts';
import { WorkerError } from '../../ui/worker-protocol.ts';

export interface ResizeSettings {
  /** 0 heißt Originalgröße */
  maxWidth: number;
  type: OutputType;
  /** 0 bis 1 */
  quality: number;
}

export interface ResizeOutput {
  blob: Blob;
  width: number;
  height: number;
}

/** Ab dieser Pixelzahl stoßen manche Browser (v. a. Safari auf iOS) an Canvas-Grenzen. */
const LARGE_CANVAS_PIXELS = 16_777_216;

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

async function render(
  width: number,
  height: number,
  settings: Pick<ResizeSettings, 'type' | 'quality'>,
  draw: (ctx: Context2D) => void,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new WorkerError('encode');
    draw(ctx);
    return canvas.convertToBlob({ type: settings.type, quality: settings.quality });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new WorkerError('encode');
  draw(ctx);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new WorkerError('encode'))),
      settings.type,
      settings.quality,
    ),
  );
}

/** Kann der Browser dieses Format erzeugen? Safari liefert z. B. statt WebP stillschweigend PNG. */
export async function supportsOutputType(type: OutputType): Promise<boolean> {
  try {
    const blob = await render(1, 1, { type, quality: 0.8 }, () => undefined);
    return blob.type === type;
  } catch {
    return false;
  }
}

export async function resizeImage(file: Blob, settings: ResizeSettings): Promise<ResizeOutput> {
  let bitmap: ImageBitmap;
  try {
    // Richtet das Bild nach der Exif-Ausrichtung aus (Standard „from-image“).
    bitmap = await createImageBitmap(file);
  } catch {
    throw new WorkerError('decode');
  }

  const { width, height } = targetSize(bitmap.width, bitmap.height, settings.maxWidth);
  let blob: Blob;
  try {
    blob = await render(width, height, settings, (ctx) => {
      if (settings.type === 'image/jpeg') {
        // JPEG kennt keine Transparenz: transparente Bereiche weiß statt schwarz.
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
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
  return { blob, width, height };
}
