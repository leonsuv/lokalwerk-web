/**
 * Zeilen aus CSV oder Excel zu einer Tabelle mit Kopfzeile aufbereiten.
 * Leere Zeilen werden entfernt, fehlende oder leere Überschriften heißen „Spalte n“.
 * Zellen bleiben unverändert (Text oder Zahl), damit Beträge aus Excel als Zahl ankommen.
 */

export type Cell = string | number;

export interface Table {
  headers: string[];
  /** Datenzeilen; `sourceRows[i]` ist die Zeilennummer in der Datei (1 = erste Zeile). */
  rows: Cell[][];
  sourceRows: number[];
}

export type TableResult = { ok: true; table: Table } | { ok: false; code: 'empty' | 'no-data' };

function toCell(value: unknown): Cell {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'WAHR' : 'FALSCH';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

const isBlank = (cell: Cell) => typeof cell === 'string' && cell.trim() === '';

export function toTable(raw: readonly (readonly unknown[])[]): TableResult {
  const numbered = raw
    .map((row, index) => ({ cells: row.map(toCell), line: index + 1 }))
    .filter(({ cells }) => cells.some((c) => !isBlank(c)));

  const [header, ...data] = numbered;
  if (!header) return { ok: false, code: 'empty' };
  if (data.length === 0) return { ok: false, code: 'no-data' };

  const width = Math.max(...numbered.map(({ cells }) => cells.length));
  const headers = Array.from({ length: width }, (_, i) => {
    const title = String(header.cells[i] ?? '').trim();
    return title === '' ? `Spalte ${i + 1}` : title;
  });

  return {
    ok: true,
    table: {
      headers,
      rows: data.map(({ cells }) => Array.from({ length: width }, (_, i) => cells[i] ?? '')),
      sourceRows: data.map(({ line }) => line),
    },
  };
}
