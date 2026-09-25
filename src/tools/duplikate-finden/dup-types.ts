/** Nachrichten zwischen Seite und Worker (eigene Datei, damit Tests ohne Browser-Typen auskommen). */

export type DupRequest =
  { type: 'read'; file: File } | { type: 'find'; columns: number[] } | { type: 'export' };

export type DupRead =
  | { ok: true; headers: string[]; rows: number; source: 'csv' | 'workbook'; sheet: string | null }
  | {
      ok: false;
      code:
        | 'empty'
        | 'no-data'
        | 'unreadable'
        | 'unterminated-quote'
        | 'encrypted'
        | 'damaged'
        | 'not-spreadsheet'
        | 'unsupported';
      line?: number;
    };

export interface FoundGroup {
  /** Zeilennummern in der Datei (Kopfzeile = 1) */
  lines: number[];
  /** Werte der gewählten Spalten aus der ersten Zeile der Gruppe */
  sample: string[];
}

export interface DupFound {
  groups: FoundGroup[];
  affectedRows: number;
}

export interface DupExport {
  bytes: Uint8Array;
  extension: 'csv' | 'xlsx';
}
