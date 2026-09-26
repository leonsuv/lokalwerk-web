/** Nachrichten zwischen Seite und Worker (eigene Datei, damit Tests ohne Browser-Typen auskommen). */

import type { TableReadError } from '../../core/table/read-file.ts';

export type IbanRequest =
  | { type: 'read'; file: File }
  | { type: 'check'; column: number }
  | { type: 'export'; column: number };

export type IbanRead =
  | { ok: true; headers: string[]; rows: number; sheet: string | null; guess: number }
  | { ok: false; code: TableReadError | 'unreadable'; line?: number };

export interface IbanRow {
  /** Zeile in der Datei (Kopfzeile = 1) */
  line: number;
  shown: string;
  ok: boolean;
  /** Fehler (rot): falsche IBAN; leere Zellen und Hinweise sind keine Fehler */
  bad: boolean;
  message: string;
}

export interface IbanChecked {
  rows: IbanRow[];
  ok: number;
  errors: number;
  nonEea: number;
  empty: number;
  repeated: number;
}

export interface IbanExport {
  bytes: Uint8Array;
  extension: 'csv' | 'xlsx';
}
