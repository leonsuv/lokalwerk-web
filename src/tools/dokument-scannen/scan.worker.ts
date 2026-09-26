/**
 * Web Worker für „Dokument scannen“: entzerrt Seiten (core/images/perspective.ts), verbessert sie
 * (core/images/enhance.ts) und legt sie in eine PDF (core/pdf/from-images.ts). Lädt pdf-lib beim
 * Start (plan.md N4).
 */

import { blackAndWhite, grayscale } from '../../core/images/enhance.ts';
import { warp, type Point } from '../../core/images/perspective.ts';
import { imagesToPdf, type PageImage } from '../../core/pdf/from-images.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';

export type ScanMode = 'color' | 'gray' | 'bw';

export type ScanRequest =
  | {
      type: 'warp';
      rgba: Uint8ClampedArray;
      width: number;
      height: number;
      /** Ecken in Pixeln des Quellbildes, oben links, oben rechts, unten rechts, unten links */
      corners: Point[];
      out: { width: number; height: number };
      mode: ScanMode;
    }
  | { type: 'build'; pages: PageImage[] };

export interface Warped {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

serveRequests<ScanRequest>(async (request) => {
  if (request.type === 'build') {
    // Jede Seite auf DIN A4, hoch oder quer nach dem Bild, ohne Rand wie bei einem Scanner
    const result = await imagesToPdf(request.pages, 'a4-auto', 0);
    return { result, transfer: [result.buffer as ArrayBuffer] };
  }
  const { rgba, width, height, corners, out, mode } = request;
  const pixels = warp(rgba, width, height, corners, out);
  if (mode === 'gray') grayscale(pixels);
  if (mode === 'bw') blackAndWhite(pixels, out.width, out.height);
  const result: Warped = { rgba: pixels, width: out.width, height: out.height };
  return { result, transfer: [pixels.buffer as ArrayBuffer] };
});
