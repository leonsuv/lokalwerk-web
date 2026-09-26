/**
 * Gemeinsames für die Foto-Werkzeuge mit Vorschau (Zuschneiden, Verpixeln, Ausweiskopie):
 * Bild laden (mit Ausrichtung nach Exif), gedreht in eine Vorschau zeichnen, als Datei kodieren.
 * Das Neu-Kodieren über ein Canvas übernimmt keine Metadaten; findMetadata prüft jede Datei.
 */

import { drawMatrix, rotatedSize, type Transform } from '../core/images/crop.ts';
import { findMetadata } from '../core/images/metadata-check.ts';
import { MAX_CANVAS_PIXELS } from '../core/pdf/raster.ts';

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export class ImageEditError extends Error {
  readonly code: 'decode' | 'too-large' | 'encode' | 'metadata';

  constructor(code: ImageEditError['code']) {
    super(`Bild: ${code}`);
    this.name = 'ImageEditError';
    this.code = code;
  }
}

export const IMAGE_ERRORS: Record<ImageEditError['code'], string> = {
  decode:
    'Das Bild lässt sich in diesem Browser nicht öffnen. iPhone-Fotos im HEIC-Format speicherst du vorher als JPEG.',
  'too-large':
    'Das Bild ist zu groß für diesen Browser. Verkleinere es zuerst mit „Fotos verkleinern“.',
  encode:
    'Das Bild konnte nicht gespeichert werden. Lade die Seite neu und versuch es noch einmal.',
  metadata: 'In der neuen Datei steckten noch Angaben; sie wurde deshalb nicht gespeichert.',
};

export const imageErrorMessage = (error: unknown): string =>
  error instanceof ImageEditError ? IMAGE_ERRORS[error.code] : IMAGE_ERRORS.encode;

export async function loadImage(file: Blob): Promise<ImageBitmap> {
  try {
    // Standard „from-image“: richtet nach der Exif-Ausrichtung aus.
    return await createImageBitmap(file);
  } catch {
    throw new ImageEditError('decode');
  }
}

/** Ausgabeformat wie das Original, sonst JPEG */
export function outputFormat(file: File): OutputFormat {
  return file.type === 'image/png'
    ? 'image/png'
    : file.type === 'image/webp'
      ? 'image/webp'
      : 'image/jpeg';
}

export const EXTENSIONS: Record<OutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Dateiname mit Zusatz, etwa „urlaub-zugeschnitten.jpg“ */
export function outputName(name: string, suffix: string, format: OutputFormat): string {
  const base = name.replace(/\.[^./\\]+$/, '').trim() || 'bild';
  return `${base}-${suffix}.${EXTENSIONS[format]}`;
}

/** Zeichnet das gedrehte Bild in `canvas`, höchstens `maxCss` breit (Auflösung nach Bildschirm) */
export function drawPreview(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  transform: Transform,
  maxCss: number,
): { width: number; height: number } {
  const size = rotatedSize(bitmap.width, bitmap.height, transform.rotate);
  const ratio = globalThis.devicePixelRatio || 1;
  const scale = Math.min(1, (maxCss * ratio) / size.width);
  canvas.width = Math.max(1, Math.round(size.width * scale));
  canvas.height = Math.max(1, Math.round(size.height * scale));
  canvas.style.width = `${Math.min(maxCss, size.width / ratio)}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageEditError('encode');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.transform(...drawMatrix(bitmap.width, bitmap.height, transform));
  ctx.drawImage(bitmap, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return size;
}

/** Faktor, um den ein Bild verkleinert werden muss, damit das Canvas überall funktioniert */
export function canvasScale(width: number, height: number): number {
  return Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
}

export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality = 0.92,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, format, format === 'image/png' ? undefined : quality),
  );
  if (!blob)
    throw new ImageEditError(
      canvas.width * canvas.height > MAX_CANVAS_PIXELS ? 'too-large' : 'encode',
    );
  if (findMetadata(new Uint8Array(await blob.arrayBuffer())).length > 0) {
    throw new ImageEditError('metadata');
  }
  return blob;
}
