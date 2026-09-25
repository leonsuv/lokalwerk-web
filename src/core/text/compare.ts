/**
 * Zwei Texte zeilenweise vergleichen, geänderte Zeilen zusätzlich wortweise (Werkzeug „Texte
 * vergleichen“). Grundlage: diff.ts (Myers).
 */

import { diff, lineKey, splitLines, splitWords, type CompareOptions } from './diff.ts';

export interface Segment {
  text: string;
  /** Gehört zur Änderung (bei entfernten Zeilen: entfernt, bei neuen: hinzugefügt) */
  changed: boolean;
}

export type Row =
  | { kind: 'equal'; oldLine: number; newLine: number; text: string }
  | { kind: 'delete'; oldLine: number; segments: Segment[] }
  | { kind: 'insert'; newLine: number; segments: Segment[] };

export interface CompareResult {
  rows: Row[];
  deleted: number;
  inserted: number;
  unchanged: number;
}

/** Höchstzahl geänderter Zeilen; darüber dauert der Vergleich zu lange. */
export const MAX_LINE_EDITS = 10_000;
/** Höchstzahl geänderter Wörter innerhalb eines Zeilenpaars */
const MAX_WORD_EDITS = 400;

function wordSegments(
  oldText: string,
  newText: string,
  options: CompareOptions,
): { old: Segment[]; new: Segment[] } | null {
  const a = splitWords(oldText);
  const b = splitWords(newText);
  const same = (x: string, y: string) =>
    (options.ignoreWhitespace && /^\s+$/.test(x) && /^\s+$/.test(y)) ||
    lineKey(x, options) === lineKey(y, options);
  const parts = diff(a, b, same, MAX_WORD_EDITS);
  if (!parts) return null;
  const old: Segment[] = [];
  const neu: Segment[] = [];
  let bi = 0;
  for (const part of parts) {
    const text = part.items.join('');
    if (part.kind === 'equal') {
      old.push({ text, changed: false });
      // Gleiche Wörter aus dem neuen Text übernehmen (können sich in Groß-/Kleinschreibung unterscheiden)
      neu.push({ text: b.slice(bi, bi + part.items.length).join(''), changed: false });
      bi += part.items.length;
    } else if (part.kind === 'delete') {
      old.push({ text, changed: true });
    } else {
      neu.push({ text, changed: true });
      bi += part.items.length;
    }
  }
  return { old, new: neu };
}

/** Gibt null zurück, wenn es mehr als MAX_LINE_EDITS geänderte Zeilen sind. */
export function compareTexts(
  oldText: string,
  newText: string,
  options: CompareOptions,
): CompareResult | null {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const keysA = a.map((l) => lineKey(l, options));
  const keysB = b.map((l) => lineKey(l, options));
  const parts = diff(
    a.map((_, i) => i),
    b.map((_, i) => i),
    // Bei gleichen Zeilen liefert diff die Nummer aus a; die Nummer aus b zählt mit.
    (i, j) => keysA[i] === keysB[j],
    MAX_LINE_EDITS,
  );
  if (!parts) return null;

  const rows: Row[] = [];
  let oldLine = 0;
  let newLine = 0;
  let deleted = 0;
  let inserted = 0;
  let unchanged = 0;
  for (let p = 0; p < parts.length; p++) {
    const part = parts[p];
    if (!part) continue;
    if (part.kind === 'equal') {
      for (const i of part.items) {
        rows.push({ kind: 'equal', oldLine: ++oldLine, newLine: ++newLine, text: a[i] ?? '' });
        unchanged++;
      }
      continue;
    }
    if (part.kind === 'insert') {
      for (const j of part.items) {
        rows.push({
          kind: 'insert',
          newLine: ++newLine,
          segments: [{ text: b[j] ?? '', changed: true }],
        });
        inserted++;
      }
      continue;
    }
    // Entfernte Zeilen; folgen neue, werden sie paarweise wortgenau verglichen.
    const next = parts[p + 1];
    const added = next?.kind === 'insert' ? next.items : [];
    const removedRows: Row[] = [];
    const addedRows: Row[] = [];
    part.items.forEach((i, n) => {
      const j = added[n];
      const words = j === undefined ? null : wordSegments(a[i] ?? '', b[j] ?? '', options);
      removedRows.push({
        kind: 'delete',
        oldLine: ++oldLine,
        segments: words ? words.old : [{ text: a[i] ?? '', changed: true }],
      });
      if (j !== undefined) {
        addedRows.push({
          kind: 'insert',
          newLine: 0,
          segments: words ? words.new : [{ text: b[j] ?? '', changed: true }],
        });
      }
    });
    for (let n = part.items.length; n < added.length; n++) {
      addedRows.push({
        kind: 'insert',
        newLine: 0,
        segments: [{ text: b[added[n] ?? 0] ?? '', changed: true }],
      });
    }
    for (const row of addedRows) if (row.kind === 'insert') row.newLine = ++newLine;
    deleted += removedRows.length;
    inserted += addedRows.length;
    rows.push(...removedRows, ...addedRows);
    if (added.length > 0) p++;
  }
  return { rows, deleted, inserted, unchanged };
}
