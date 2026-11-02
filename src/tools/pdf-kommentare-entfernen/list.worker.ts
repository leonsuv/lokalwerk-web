/**
 * Web Worker für „PDF-Kommentare entfernen“: listet die Anmerkungen der PDF auf (Seite, Art,
 * kurzer Text). Die Anzeigetexte bleiben im Gerät. Gegenstück zur Seite: ./page.ts.
 */

import { listAnnotations } from '../../core/pdf/annotations.ts';
import { readFile } from '../../ui/pdf-worker.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';

serveRequests<{ type: 'list'; file: File }>(async (request) => ({
  result: await listAnnotations(await readFile(request.file)),
}));
