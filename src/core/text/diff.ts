/**
 * Unterschiede zwischen zwei Folgen finden (Werkzeug „Texte vergleichen“, plan-phase2.md 27).
 *
 * Verfahren: E. W. Myers, „An O(ND) Difference Algorithm and Its Variations“, Algorithmica 1
 * (1986), S. 251–266, Grundform mit Rückverfolgung. Ergebnis ist eine kürzeste Folge aus
 * Löschen und Einfügen. Gemeinsamer Anfang und gemeinsames Ende werden vorher abgeschnitten.
 * Gespeichert wird je Schritt d nur der Bereich −d … d, also O(D²) Speicher.
 */

export type DiffKind = 'equal' | 'delete' | 'insert';

export interface DiffPart<T> {
  kind: DiffKind;
  items: T[];
}

/**
 * Kürzeste Bearbeitung von `a` nach `b`. Gibt null zurück, wenn mehr als `maxEdits`
 * Änderungen nötig wären (Schutz vor sehr langer Rechenzeit).
 */
export function diff<T>(
  a: readonly T[],
  b: readonly T[],
  equals: (x: T, y: T) => boolean = (x, y) => x === y,
  maxEdits = Number.POSITIVE_INFINITY,
): DiffPart<T>[] | null {
  let start = 0;
  while (start < a.length && start < b.length && equals(a[start] as T, b[start] as T)) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && equals(a[endA - 1] as T, b[endB - 1] as T)) {
    endA--;
    endB--;
  }
  const middle = myers(a.slice(start, endA), b.slice(start, endB), equals, maxEdits);
  if (!middle) return null;

  const parts: DiffPart<T>[] = [];
  const push = (kind: DiffKind, items: T[]) => {
    if (items.length === 0) return;
    const last = parts.at(-1);
    if (last?.kind === kind) last.items.push(...items);
    else parts.push({ kind, items: [...items] });
  };
  push('equal', a.slice(0, start));
  for (const part of middle) push(part.kind, part.items);
  push('equal', a.slice(endA));
  return parts;
}

function myers<T>(
  a: readonly T[],
  b: readonly T[],
  equals: (x: T, y: T) => boolean,
  maxEdits: number,
): DiffPart<T>[] | null {
  const n = a.length;
  const m = b.length;
  // trace[d][k + d] = weitestes x auf Diagonale k nach d Änderungen
  const trace: Int32Array[] = [];
  const at = (d: number, k: number): number => {
    if (d < 0) return k === 1 ? 0 : -1;
    return trace[d]?.[k + d] ?? -1;
  };

  let found = -1;
  for (let d = 0; d <= n + m; d++) {
    if (d > maxEdits) return null;
    const v = new Int32Array(2 * d + 1);
    trace.push(v);
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && at(d - 1, k - 1) < at(d - 1, k + 1))
          ? at(d - 1, k + 1) // von oben: Einfügen
          : at(d - 1, k - 1) + 1; // von links: Löschen
      let y = x - k;
      while (x < n && y < m && equals(a[x] as T, b[y] as T)) {
        x++;
        y++;
      }
      v[k + d] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }

  // Rückverfolgung vom Ende zum Anfang
  const reversed: { kind: DiffKind; item: T }[] = [];
  let x = n;
  let y = m;
  for (let d = found; d >= 0; d--) {
    const k = x - y;
    const fromAbove = k === -d || (k !== d && at(d - 1, k - 1) < at(d - 1, k + 1));
    const prevK = fromAbove ? k + 1 : k - 1;
    const prevX = d === 0 ? 0 : at(d - 1, prevK);
    const prevY = d === 0 ? 0 : prevX - prevK;
    while (x > prevX && y > prevY) {
      reversed.push({ kind: 'equal', item: a[x - 1] as T });
      x--;
      y--;
    }
    if (d > 0) {
      if (fromAbove) {
        reversed.push({ kind: 'insert', item: b[y - 1] as T });
        y--;
      } else {
        reversed.push({ kind: 'delete', item: a[x - 1] as T });
        x--;
      }
    }
  }

  const parts: DiffPart<T>[] = [];
  for (let i = reversed.length - 1; i >= 0; i--) {
    const { kind, item } = reversed[i] as { kind: DiffKind; item: T };
    const last = parts.at(-1);
    if (last?.kind === kind) last.items.push(item);
    else parts.push({ kind, items: [item] });
  }
  return parts;
}

/** Text in Zeilen; ein Zeilenende am Schluss erzeugt keine leere letzte Zeile. */
export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/** Wörter, Leerraum und einzelne Satzzeichen, damit Änderungen genau markiert werden können. */
export function splitWords(line: string): string[] {
  return line.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

export interface CompareOptions {
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
}

/** Vergleichsschlüssel einer Zeile nach den Einstellungen */
export function lineKey(line: string, options: CompareOptions): string {
  let key = options.ignoreWhitespace ? line.trim().replace(/\s+/g, ' ') : line;
  if (options.ignoreCase) key = key.toLocaleLowerCase('de');
  return key;
}
