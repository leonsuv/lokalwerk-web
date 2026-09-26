/**
 * Web Worker für „Unterschrift einfügen“. Lädt pdf-lib beim Start (plan.md N4).
 */

import type { NormRect } from '../../core/geometry/norm-rect.ts';
import { placeImage } from '../../core/pdf/place-image.ts';
import { inspectForStamp } from '../../core/pdf/stamp.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export type SignRequest =
  | { type: 'inspect'; file: File }
  | { type: 'sign'; file: File; png: Uint8Array; placements: { page: number; rect: NormRect }[] };

async function readFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw new WorkerError(
      /allocation failed|out of memory/i.test(String(error)) ? 'out-of-memory' : 'unreadable',
    );
  }
}

serveRequests<SignRequest>(async (request) => {
  const bytes = await readFile(request.file);
  if (request.type === 'inspect') return { result: await inspectForStamp(bytes) };
  const result = await placeImage(bytes, request.png, request.placements);
  return { result, transfer: [result.buffer as ArrayBuffer] };
});
