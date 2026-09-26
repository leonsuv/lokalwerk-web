/**
 * Web Worker für „Ausweiskopie erstellen“: legt die fertig geschwärzten und gekennzeichneten
 * JPEG-Bilder auf eine DIN-A4-Seite (core/pdf/id-copy.ts). Lädt pdf-lib beim Start (plan.md N4).
 */

import { buildIdCopyPdf, type IdImage } from '../../core/pdf/id-copy.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';

export type IdCopyRequest = { type: 'build'; images: IdImage[] };

serveRequests<IdCopyRequest>(async (request) => {
  const result = await buildIdCopyPdf(request.images);
  return { result, transfer: [result.buffer as ArrayBuffer] };
});
