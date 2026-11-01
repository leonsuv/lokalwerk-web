/**
 * Web Worker für „Mehrere Seiten pro Blatt“. Lädt pdf-lib beim Start (plan.md N4).
 */

import { GRIDS, imposePages, nUpSheets } from '../../core/pdf/impose.ts';
import { loadPdf } from '../../core/pdf/merge.ts';
import { servePdfTool } from '../../ui/pdf-worker.ts';

export interface NUpOptions {
  perSheet: number;
  border: boolean;
}

/** 10 mm Rand und 4 mm Abstand, in Punkt */
const MARGIN = (10 * 72) / 25.4;
const GAP = (4 * 72) / 25.4;

servePdfTool<NUpOptions>(async (bytes, options) => {
  const grid = GRIDS[options.perSheet];
  if (!grid) throw Object.assign(new Error('Anzahl'), { code: 'damaged' });
  const total = (await loadPdf(bytes)).getPageCount();
  const out = await imposePages(bytes, {
    sheets: nUpSheets(total, options.perSheet),
    grid,
    margin: MARGIN,
    gap: GAP,
    border: options.border,
  });
  return [{ name: '', bytes: out }];
});
