/**
 * Web Worker für „PDF in Graustufen“. Baut die neue PDF nur aus den fertig umgerechneten
 * Seitenbildern (core/pdf/redact.ts, buildRasterPdf); die Original-PDF bekommt er nicht.
 * Lädt pdf-lib beim Start, damit die Seite danach offline funktioniert (plan.md N4).
 */

import { buildRasterPdf, type RasterPage } from '../../core/pdf/redact.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';

export type GrayRequest = { type: 'build'; pages: RasterPage[] };

serveRequests<GrayRequest>(async (request) => {
  const result = await buildRasterPdf(request.pages);
  return { result, transfer: [result.buffer as ArrayBuffer] };
});
