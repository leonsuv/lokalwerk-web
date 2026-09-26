/**
 * Web Worker für „Foto-Metadaten anzeigen“. exifr (Lite) liest nur Bytes, nie Adressen
 * (docs/exifr.md). „Ohne Metadaten speichern“ kodiert das Bild neu (wie Bildformat umwandeln)
 * und prüft das Ergebnis.
 */

import { parse } from 'exifr/dist/lite.esm.mjs';
import type { ImageFormat } from '../../core/images/convert.ts';
import { describeMetadata } from '../../core/images/exif-read.ts';
import { findMetadata } from '../../core/images/metadata-check.ts';
import { serveRequests } from '../../ui/worker-protocol.ts';
import { convertImage } from '../bildformat-umwandeln/convert.ts';
import type { MetaRead, MetaRequest, MetaStripped } from './meta-types.ts';

export type { MetaRequest };

const OPTIONS = {
  tiff: true,
  exif: true,
  gps: true,
  xmp: true,
  ifd1: false,
  mergeOutput: false,
  reviveValues: false,
  translateValues: false,
};

async function read(file: File): Promise<MetaRead> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, code: 'unreadable' };
  }
  const findings = findMetadata(bytes);
  let parsed: Record<string, Record<string, unknown> | undefined> | undefined;
  try {
    parsed = (await parse(bytes, OPTIONS)) as typeof parsed;
  } catch {
    // Kein Exif lesbar: dann zeigt die eigene Prüfung, was sie findet.
    parsed = undefined;
  }
  if (findings.includes('unknown-format')) return { ok: false, code: 'damaged' };
  return {
    ok: true,
    report: describeMetadata(parsed, {
      xmp: findings.includes('xmp'),
      iptc: findings.includes('iptc'),
      comment: findings.includes('comment'),
    }),
  };
}

async function strip(file: File): Promise<MetaStripped> {
  const type: ImageFormat =
    file.type === 'image/png'
      ? 'image/png'
      : file.type === 'image/webp'
        ? 'image/webp'
        : 'image/jpeg';
  // convertImage prüft das Ergebnis selbst und wirft, falls noch Metadaten darin stecken.
  return { blob: await convertImage(file, { type, quality: 0.92 }) };
}

serveRequests<MetaRequest>(async (request) => {
  if (request.type === 'read') return { result: await read(request.file) };
  return { result: await strip(request.file) };
});
