/** Ergebnis des Einlesens im Worker (eigene Datei, damit Tests ohne Browser-Typen auskommen). */

import type { TextEncoding } from '../../core/csv/decode.ts';
import type { SheetErrorCode } from '../../core/sheet/xlsx.ts';

export type ReadResult =
  | { ok: true; rows: unknown[][]; encoding: TextEncoding | null }
  | { ok: false; code: SheetErrorCode | 'unterminated-quote' | 'unreadable'; line?: number };
