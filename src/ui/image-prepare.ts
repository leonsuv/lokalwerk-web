/**
 * Bild für die PDF vorbereiten: dekodieren (mit Ausrichtung nach Exif), bei Bedarf
 * verkleinern und neu kodieren. Das Neu-Kodieren entfernt Metadaten wie GPS-Position und
 * Kameradaten; bei JPEG prüft findMetadata das zusätzlich. Läuft im Worker (OffscreenCanvas)
 * oder, falls der Browser das nicht kann, auf der Seite. Gemeinsam für „Bilder zu PDF“ und die
 * PDF-Werkstatt (plan-phase3.md 4.2).
 */

import { findMetadata } from '../core/images/metadata-check.ts';
import type { PageImage } from '../core/pdf/from-images.ts';
import { renderToBlob } from './canvas.ts';
import { WorkerError } from './worker-protocol.ts';

export type ImageQuality = 'original' | 'small';

/** Längste Kante bei „kleiner, für E-Mail“: reicht für A4 mit etwa 170 dpi. */
const SMALL_LONG_EDGE = 2000;
/** Ab dieser Pixelzahl stoßen manche Browser (v. a. Safari auf iOS) an Canvas-Grenzen. */
const MAX_PIXELS = 16_777_216;

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new WorkerError('decode');
  }
}

export async function inspectImage(file: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await decode(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

function targetSize(width: number, height: number, quality: ImageQuality) {
  let scale = 1;
  if (quality === 'small') scale = Math.min(1, SMALL_LONG_EDGE / Math.max(width, height));
  if (width * height * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (width * height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareImage(
  file: Blob,
  sourceIsJpeg: boolean,
  quality: ImageQuality,
): Promise<PageImage> {
  const bitmap = await decode(file);
  const { width, height } = targetSize(bitmap.width, bitmap.height, quality);
  // JPEG bleibt JPEG; alles andere bleibt verlustfrei PNG, außer bei „kleiner“.
  const type = quality === 'small' || sourceIsJpeg ? 'image/jpeg' : 'image/png';
  let blob: Blob;
  try {
    blob = await renderToBlob(
      width,
      height,
      { type, quality: quality === 'small' ? 0.8 : 0.92 },
      (ctx) => {
        if (type === 'image/jpeg') {
          // JPEG kennt keine Transparenz: transparente Bereiche weiß statt schwarz.
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, width, height);
      },
    );
  } catch {
    throw new WorkerError('encode');
  } finally {
    bitmap.close();
  }
  if (blob.type !== type) throw new WorkerError('encode');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (type === 'image/jpeg' && findMetadata(bytes).length > 0) throw new WorkerError('metadata');
  return { bytes, type, width, height };
}
