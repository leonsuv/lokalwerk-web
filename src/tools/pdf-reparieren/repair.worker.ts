/**
 * Web Worker für „PDF reparieren“: repariert die Datei (core/pdf/repair.ts) und liefert die neue
 * PDF mit den Zahlen für die Meldung. Lädt pdf-lib beim Start, damit die Seite danach offline
 * funktioniert (plan.md N4).
 */

import { countDirect, repairPdf } from '../../core/pdf/repair.ts';
import { servePdfTool } from '../../ui/pdf-worker.ts';

export type RepairOptions = Record<string, never>;

servePdfTool<RepairOptions>(async (bytes) => {
  const result = await repairPdf(bytes);
  return {
    files: [{ name: '', bytes: result.bytes }],
    pages: result.readable,
    lost: result.lost,
    missing: result.missing,
  };
}, countDirect);
