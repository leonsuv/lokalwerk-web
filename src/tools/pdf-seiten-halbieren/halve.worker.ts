/**
 * Web Worker für „PDF-Seiten halbieren“. Lädt pdf-lib beim Start (plan.md N4).
 */

import { halvePages, type HalveDirection } from '../../core/pdf/halve.ts';
import { servePdfTool } from '../../ui/pdf-worker.ts';

export interface HalveOptions {
  direction: HalveDirection;
}

servePdfTool<HalveOptions>(async (bytes, options) => [
  { name: '', bytes: await halvePages(bytes, options.direction) },
]);
