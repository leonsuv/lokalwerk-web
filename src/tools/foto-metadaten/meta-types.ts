/** Nachrichten zwischen Seite und Worker (eigene Datei, damit Tests ohne Browser-Typen auskommen). */

import type { MetaReport } from '../../core/images/exif-read.ts';

export type MetaRequest = { type: 'read'; file: File } | { type: 'strip'; file: File };

export type MetaRead =
  { ok: true; report: MetaReport } | { ok: false; code: 'unreadable' | 'damaged' };

export interface MetaStripped {
  blob: Blob;
}
