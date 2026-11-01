/**
 * Web Worker für „Leere Seiten entfernen“: übernimmt die behaltenen Seiten in eine neue PDF.
 * Lädt pdf-lib beim Start (plan.md N4).
 */

import { organizePdf } from '../../core/pdf/organize.ts';
import { servePdfTool } from '../../ui/pdf-worker.ts';

export interface BlankOptions {
  /** Zu behaltende Seiten, ab 1 */
  keep: number[];
}

servePdfTool<BlankOptions>(async (bytes, options) => [
  {
    name: '',
    bytes: await organizePdf(
      bytes,
      options.keep.map((source) => ({ source, rotate: 0 })),
    ),
  },
]);
