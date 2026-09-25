/**
 * Doppelte Zeilen in Listen finden (Werkzeug „Duplikate finden“, plan-phase2.md 23).
 *
 * Nur exakte Treffer nach Normalisierung, keine unscharfen Vermutungen („Meier“ ≠ „Maier“).
 * Normalisiert werden: Groß-/Kleinschreibung, Leerraum am Rand und mehrfacher Leerraum,
 * ä/ae, ö/oe, ü/ue, ß/ss, Akzente (é/e) und Leerzeichen in IBANs. Gelöscht wird nie etwas.
 */

const IBAN_LIKE = /^[a-z]{2}\d{2}[a-z0-9]{10,30}$/;

export function normalizeValue(value: string): string {
  let text = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
  text = text.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  text = text.normalize('NFD').replace(/\p{M}/gu, '');
  const compact = text.replace(/ /g, '');
  return IBAN_LIKE.test(compact) ? compact : text;
}

export interface DuplicateGroup {
  /** Zeilennummern der Datenzeilen (ab 0, ohne Kopfzeile), in Reihenfolge der Datei */
  rows: number[];
}

/**
 * Gruppen von Zeilen, die in allen gewählten Spalten nach Normalisierung gleich sind.
 * Zeilen, die in allen gewählten Spalten leer sind, zählen nicht.
 */
export function findDuplicates(
  rows: readonly (readonly string[])[],
  columns: readonly number[],
): DuplicateGroup[] {
  if (columns.length === 0) return [];
  const byKey = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const parts = columns.map((c) => normalizeValue(row[c] ?? ''));
    if (parts.every((p) => p === '')) return;
    // Trennzeichen, das in normalisierten Werten nicht vorkommt
    const key = parts.join('\u0000');
    const list = byKey.get(key);
    if (list) list.push(index);
    else byKey.set(key, [index]);
  });
  return [...byKey.values()].filter((list) => list.length > 1).map((list) => ({ rows: list }));
}

/** Gruppennummer je Datenzeile (ab 1), 0 für Zeilen ohne Doppel */
export function groupNumbers(rowCount: number, groups: readonly DuplicateGroup[]): number[] {
  const numbers = new Array<number>(rowCount).fill(0);
  groups.forEach((g, i) => {
    for (const r of g.rows) numbers[r] = i + 1;
  });
  return numbers;
}
