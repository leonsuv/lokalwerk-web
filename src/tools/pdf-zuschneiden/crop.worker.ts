/**
 * Web Worker für „PDF zuschneiden“. Lädt pdf-lib beim Start (plan.md N4).
 */

import type { Margins } from '../../core/pdf/crop-geometry.ts';
import { cropPages } from '../../core/pdf/crop.ts';
import { servePdfTool } from '../../ui/pdf-worker.ts';

export interface CropOptions {
  /** Ränder in Punkt */
  margins: Margins;
  /** Seiten ab 0; null für alle */
  pages: number[] | null;
}

servePdfTool<CropOptions>(async (bytes, options) => [
  { name: '', bytes: await cropPages(bytes, options.margins, options.pages) },
]);
