/**
 * Web Worker für „Bilder zu PDF“. Lädt pdf-lib beim Start, damit die Seite nach dem ersten
 * Anzeigen offline funktioniert (plan.md N4). Bilder werden hier vorbereitet, wenn der Browser
 * OffscreenCanvas im Worker kann; sonst kommen sie fertig von der Seite.
 */

import { imagesToPdf, type PageImage, type PageLayout } from '../../core/pdf/from-images.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';
import { inspectImage, prepareImage, type ImageQuality } from '../../ui/image-prepare.ts';

export interface ImageSource {
  file: File;
  jpeg: boolean;
}

export type ImagesRequest =
  | { type: 'canvas' }
  | { type: 'inspect'; file: File }
  | {
      type: 'build';
      /** Entweder Dateien (werden hier vorbereitet) oder schon vorbereitete Bilder */
      sources: ImageSource[] | PageImage[];
      quality: ImageQuality;
      layout: PageLayout;
      marginMm: number;
    };

export interface ImagesProgress {
  done: number;
  total: number;
}

const isPrepared = (sources: ImageSource[] | PageImage[]): sources is PageImage[] =>
  sources.every((s) => 'bytes' in s);

serveRequests<ImagesRequest>(async (request, progress) => {
  if (request.type === 'canvas') return { result: typeof OffscreenCanvas !== 'undefined' };
  if (request.type === 'inspect') return { result: await inspectImage(request.file) };

  const total = request.sources.length;
  let images: PageImage[];
  if (isPrepared(request.sources)) {
    images = request.sources;
  } else {
    images = [];
    for (const source of request.sources) {
      images.push(await prepareImage(source.file, source.jpeg, request.quality));
      progress({ done: images.length, total } satisfies ImagesProgress);
    }
  }
  const bytes = await imagesToPdf(images, request.layout, request.marginMm);
  return { result: bytes, transfer: [bytes.buffer as ArrayBuffer] };
});
