/** Web Worker für „Bildformat umwandeln“. Startet beim Öffnen der Seite (plan.md N4). */

import type { ImageFormat } from '../../core/images/convert.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';
import { convertImage, supportsFormat, type ConvertSettings } from './convert.ts';

export type ConvertImageRequest =
  | { type: 'convert'; file: File; settings: ConvertSettings }
  | { type: 'supports'; format: ImageFormat };

serveRequests<ConvertImageRequest>(async (request) => {
  if (request.type === 'supports') return { result: await supportsFormat(request.format) };
  return { result: await convertImage(request.file, request.settings) };
});
