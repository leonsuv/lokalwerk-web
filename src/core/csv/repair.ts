/**
 * Doppelt kodierte Umlaute reparieren (Werkzeug „CSV reparieren“, plan-phase2.md 21).
 *
 * Typischer Fehler: Text wurde als UTF-8 gespeichert und danach als Windows-1252 gelesen und
 * wieder gespeichert. Aus „ä“ (UTF-8: C3 A4) wird so „Ã¤“. Repariert wird nur, wenn das Muster
 * eindeutig ist:
 * 1. Die Zelle enthält ein Startzeichen einer UTF-8-Folge (Bytes C2–F4 in Windows-1252 gelesen),
 *    direkt gefolgt von einem Folgezeichen (Bytes 80–BF).
 * 2. Die ganze Zelle lässt sich verlustfrei in Windows-1252-Bytes zurückwandeln.
 * 3. Diese Bytes sind gültiges UTF-8 (strenge Prüfung).
 * Sonst bleibt die Zelle unverändert und wird als „nicht eindeutig“ gemeldet. Die Zuordnung der
 * Bytes kommt aus dem Decoder des Browsers (WHATWG Encoding Standard), nicht aus einer Tabelle.
 */

let tables: { toByte: Map<string, number>; lead: Set<string>; cont: Set<string> } | undefined;

function cp1252(): NonNullable<typeof tables> {
  if (!tables) {
    const decoder = new TextDecoder('windows-1252');
    const char = (byte: number) => decoder.decode(new Uint8Array([byte]));
    const toByte = new Map<string, number>();
    for (let byte = 0x80; byte <= 0xff; byte++) toByte.set(char(byte), byte);
    const lead = new Set<string>();
    for (let byte = 0xc2; byte <= 0xf4; byte++) lead.add(char(byte));
    const cont = new Set<string>();
    for (let byte = 0x80; byte <= 0xbf; byte++) cont.add(char(byte));
    tables = { toByte, lead, cont };
  }
  return tables;
}

/** Enthält der Text ein Startzeichen, direkt gefolgt von einem Folgezeichen? */
export function looksDoubleEncoded(text: string): boolean {
  const { lead, cont } = cp1252();
  const chars = [...text];
  return chars.some((c, i) => lead.has(c) && cont.has(chars[i + 1] ?? ''));
}

/** Reparierter Text, oder null, wenn es nichts zu reparieren gibt oder das Muster nicht eindeutig ist. */
export function repairText(text: string): string | null {
  if (!looksDoubleEncoded(text)) return null;
  const { toByte } = cp1252();
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const byte = code < 0x80 ? code : toByte.get(char);
    if (byte === undefined) return null;
    bytes.push(byte);
  }
  let repaired: string;
  try {
    repaired = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
  return repaired === text ? null : repaired;
}

export interface CellChange {
  /** Zeile in der Datei, ab 1 */
  row: number;
  /** Spalte, ab 1 */
  column: number;
  before: string;
  after: string;
}

export interface RepairAnalysis {
  changes: CellChange[];
  /** Zellen mit verdächtigem Muster, die sich nicht eindeutig reparieren lassen */
  unsure: Omit<CellChange, 'after'>[];
}

export function analyzeRepairs(rows: readonly (readonly string[])[]): RepairAnalysis {
  const changes: CellChange[] = [];
  const unsure: Omit<CellChange, 'after'>[] = [];
  rows.forEach((cells, r) => {
    cells.forEach((cell, c) => {
      if (!looksDoubleEncoded(cell)) return;
      const after = repairText(cell);
      if (after === null) unsure.push({ row: r + 1, column: c + 1, before: cell });
      else changes.push({ row: r + 1, column: c + 1, before: cell, after });
    });
  });
  return { changes, unsure };
}

export function applyRepairs(
  rows: readonly (readonly string[])[],
  changes: readonly CellChange[],
): string[][] {
  const out = rows.map((cells) => [...cells]);
  for (const change of changes) {
    const row = out[change.row - 1];
    if (row) row[change.column - 1] = change.after;
  }
  return out;
}

/** Zeilen, deren Spaltenzahl von der häufigsten abweicht (oft ein verrutschtes Trennzeichen) */
export function irregularRows(rows: readonly (readonly string[])[]): {
  expected: number;
  rows: number[];
} {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
  let expected = 0;
  let best = -1;
  for (const [length, n] of counts) if (n > best) [expected, best] = [length, n];
  return {
    expected,
    rows: rows.flatMap((r, i) => (r.length !== expected ? [i + 1] : [])),
  };
}
