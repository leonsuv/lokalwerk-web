/**
 * Gegenstück zu pdf-tool.ts im Web Worker: liest die Datei, beantwortet „inspect“ mit der
 * Seitenzahl und führt für „run“ die Funktion des Werkzeugs aus. Lädt pdf-lib beim Start, damit
 * die Seite danach offline funktioniert (plan.md N4).
 */

import { countPages } from '../core/pdf/merge.ts';
import type { PdfToolOutput, PdfToolRequest } from './pdf-tool.ts';
import { serveRequests, WorkerError } from './worker-protocol.ts';

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

/**
 * `run` bekommt die Bytes und die Einstellungen und liefert die Dateien (oder die Dateien mit
 * Zahlen für die Meldung); ein leerer Name heißt „Name der Quelle plus Zusatz“. Fehler mit Code
 * `code` zeigt die Seite in ihrer Meldungstabelle. `inspect` liefert die Seitenzahl für die
 * Anzeige; null heißt „nicht lesbar“, die Datei bleibt dann trotzdem wählbar.
 */
export function servePdfTool<O>(
  run: (bytes: Uint8Array, options: O) => Promise<PdfToolOutput['files'] | PdfToolOutput>,
  inspect: (bytes: Uint8Array) => Promise<number | null> = countPages,
): void {
  serveRequests<PdfToolRequest<O>>(async (request) => {
    const bytes = await readFile(request.file);
    if (request.type === 'inspect') return { result: await inspect(bytes) };
    const raw = await run(bytes, request.options);
    const output: PdfToolOutput = Array.isArray(raw) ? { files: raw } : raw;
    return {
      result: output,
      transfer: output.files.map((f) => f.bytes.buffer as ArrayBuffer),
    };
  });
}
