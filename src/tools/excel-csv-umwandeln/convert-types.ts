/** Nachrichten zwischen Seite und Worker (eigene Datei, damit Tests ohne Browser-Typen auskommen). */

import type { TextEncoding } from '../../core/csv/decode.ts';
import type { OutputEncoding } from '../../core/csv/encode.ts';
import type { Delimiter } from '../../core/csv/parse.ts';
import type { SheetErrorCode } from '../../core/sheet/xlsx.ts';
import type { DecimalMark, SheetValue } from '../../core/sheet/values.ts';

export const PREVIEW_ROWS = 10;

export type ConvertRequest =
  | { type: 'read'; file: File }
  | {
      type: 'to-csv';
      sheet: number;
      delimiter: Delimiter;
      decimal: DecimalMark;
      encoding: OutputEncoding;
    }
  | { type: 'to-xlsx'; detect: boolean; decimal: DecimalMark };

export interface SheetSummary {
  name: string;
  rows: number;
  columns: number;
  preview: SheetValue[][];
}

export type ReadOutcome =
  | { ok: true; kind: 'workbook'; sheets: SheetSummary[] }
  | {
      ok: true;
      kind: 'csv';
      sheet: SheetSummary;
      encoding: TextEncoding;
      delimiter: Delimiter;
    }
  | {
      ok: false;
      code: SheetErrorCode | 'unterminated-quote' | 'unreadable' | 'unsupported';
      line?: number;
    };

export type CsvOutcome =
  | { ok: true; bytes: Uint8Array; rows: number }
  | { ok: false; code: 'unsupported'; chars: string[]; line: number };

export interface XlsxOutcome {
  bytes: Uint8Array;
  rows: number;
  numbers: number;
  dates: number;
}
