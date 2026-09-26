/**
 * Web Worker für „PDF schwärzen“. Baut die neue PDF nur aus den fertig geschwärzten Seitenbildern;
 * die Original-PDF bekommt er nicht (core/pdf/redact.ts). Lädt pdf-lib beim Start (plan.md N4).
 */

import { buildRasterPdf, type RasterPage } from '../../core/pdf/redact.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';

export type RedactRequest = { type: 'build'; pages: RasterPage[] };

serveRequests<RedactRequest>(async (request) => {
  const result = await buildRasterPdf(request.pages);
  return { result, transfer: [result.buffer as ArrayBuffer] };
});
