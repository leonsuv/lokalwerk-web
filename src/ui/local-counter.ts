/**
 * Zähler „… lokal verarbeitet“ in der Plakette der Kopfzeile. Zählt nur, was auf dieser
 * Seite im Browser verarbeitet wurde; hochgeladen wird nie etwas (AGENTS.md Regel 1).
 */

import { formatBytes } from '../core/format/bytes.ts';
import { $$ } from './dom.ts';

let processedBytes = 0;

export function countLocalBytes(bytes: number): void {
  processedBytes += bytes;
  for (const element of $$('[data-local-bytes]')) element.textContent = formatBytes(processedBytes);
}
