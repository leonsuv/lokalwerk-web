/**
 * Mehrere im Browser erzeugte Dateien als ein ZIP-Archiv ohne Kompression (plan-phase2.md E3).
 * Die Inhalte werden nur für die Prüfsumme stückweise gelesen und nicht kopiert: Das Archiv
 * ist ein Blob aus Verwaltungsdaten und den ursprünglichen Blobs.
 */

import { crc32, uniqueNames, zipLayout } from '../core/zip/write.ts';

export interface ZipInput {
  name: string;
  blob: Blob;
}

async function blobCrc32(blob: Blob): Promise<number> {
  const reader = blob.stream().getReader();
  let crc = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return crc;
    crc = crc32(value, crc);
  }
}

/** Wirft ZipError (zu groß, zu viele Dateien, leer). */
export async function zipBlobs(files: readonly ZipInput[]): Promise<Blob> {
  const names = uniqueNames(files.map((f) => f.name));
  const modified = new Date();
  const entries = [];
  for (const [i, file] of files.entries()) {
    entries.push({
      name: names[i] ?? file.name,
      size: file.blob.size,
      crc: await blobCrc32(file.blob),
      modified,
    });
  }
  const layout = zipLayout(entries);
  const parts: BlobPart[] = files.flatMap((file, i) => [
    layout.localHeaders[i] as Uint8Array<ArrayBuffer>,
    file.blob,
  ]);
  parts.push(layout.centralDirectory as Uint8Array<ArrayBuffer>);
  return new Blob(parts, { type: 'application/zip' });
}
