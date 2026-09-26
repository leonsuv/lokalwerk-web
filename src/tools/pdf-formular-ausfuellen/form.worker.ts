/**
 * Web Worker für „PDF-Formular ausfüllen“. Lädt pdf-lib beim Start (plan.md N4).
 */

import { fillForm, readForm, type FieldValue } from '../../core/pdf/form.ts';
import { standardFontCharset } from '../../core/pdf/stamp.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type FormRequest =
  | { type: 'read'; file: File }
  | { type: 'charset' }
  | { type: 'fill'; file: File; values: Record<string, FieldValue>; flatten: boolean };

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

serveRequests<FormRequest>(async (request) => {
  if (request.type === 'charset') return { result: await standardFontCharset() };
  const bytes = await readFile(request.file);
  if (request.type === 'read') return { result: await readForm(bytes) };
  const result = await fillForm(bytes, request.values, request.flatten);
  return { result, transfer: [result.buffer as ArrayBuffer] };
});
