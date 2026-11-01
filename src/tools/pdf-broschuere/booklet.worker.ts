/**
 * Web Worker für „Broschüre“. Lädt pdf-lib beim Start (plan.md N4).
 */

import { bookletSheets, GRIDS, imposePages } from '../../core/pdf/impose.ts';
import { loadPdf } from '../../core/pdf/merge.ts';
import { servePdfTool } from '../../ui/pdf-worker.ts';

/** 5 mm Rand, kein Abstand: Die Falz liegt in der Mitte des Blattes */
const MARGIN = (5 * 72) / 25.4;

servePdfTool<Record<string, never>>(async (bytes) => {
  const total = (await loadPdf(bytes)).getPageCount();
  const out = await imposePages(bytes, {
    sheets: bookletSheets(total),
    grid: GRIDS[2] ?? { cols: 2, rows: 1, landscape: true },
    margin: MARGIN,
    gap: 0,
    border: false,
  });
  return [{ name: '', bytes: out }];
});
