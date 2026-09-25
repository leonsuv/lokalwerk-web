/** Nachrichten zwischen Seite und Worker (eigene Datei, damit Tests ohne Browser-Typen auskommen). */

import type { TextEncoding } from '../../core/csv/decode.ts';
import type { OutputEncoding } from '../../core/csv/encode.ts';
import type { Delimiter } from '../../core/csv/parse.ts';
import type { CellChange } from '../../core/csv/repair.ts';

export const PREVIEW_ROWS = 8;
/** So viele Änderungen werden einzeln gezeigt; die Anzahl steht immer dabei */
export const MAX_LISTED = 200;

export type RepairRequest =
  | { type: 'read'; file: File }
  | { type: 'save'; repair: boolean; delimiter: Delimiter; encoding: OutputEncoding };

export type ReadSummary =
  | {
      ok: true;
      encoding: TextEncoding;
      delimiter: Delimiter;
      rows: number;
      columns: number;
      irregular: { expected: number; rows: number[] };
      changes: CellChange[];
      changeCount: number;
      unsure: Omit<CellChange, 'after'>[];
      unsureCount: number;
      /** Erste Zeilen mit und ohne Reparatur */
      preview: string[][];
      previewRaw: string[][];
      headers: string[];
    }
  | { ok: false; code: 'empty' | 'unreadable' | 'unterminated-quote'; line?: number };

export type SaveResult =
  | { ok: true; bytes: Uint8Array; repaired: number }
  | { ok: false; code: 'unsupported'; chars: string[]; line: number };
