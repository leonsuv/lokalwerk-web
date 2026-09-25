/**
 * Bild auf eine Zeichenfläche malen und als Datei kodieren. Mit OffscreenCanvas (Worker und
 * neuere Browser), sonst mit einem <canvas> auf der Seite. Das Neu-Kodieren übernimmt keine
 * Metadaten des Originals.
 */

import { WorkerError } from './worker-protocol.ts';

export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export async function renderToBlob(
  width: number,
  height: number,
  settings: { type: string; quality?: number },
  draw: (ctx: Context2D) => void,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new WorkerError('encode');
    draw(ctx);
    return canvas.convertToBlob(
      settings.quality === undefined
        ? { type: settings.type }
        : { type: settings.type, quality: settings.quality },
    );
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
