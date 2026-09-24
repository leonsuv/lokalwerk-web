/** Web Worker für „Fotos verkleinern“. Startet beim Öffnen der Seite (plan.md N4). */

import type { OutputType } from '../../core/images/resize.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';
import { resizeImage, supportsOutputType, type ResizeSettings } from './resize.ts';

export type ResizeRequest =
  | { type: 'resize'; file: File; settings: ResizeSettings }
  | { type: 'supports'; outputType: OutputType };

serveRequests<ResizeRequest>(async (request) => {
  if (request.type === 'supports') return { result: await supportsOutputType(request.outputType) };
  return { result: await resizeImage(request.file, request.settings) };
});
