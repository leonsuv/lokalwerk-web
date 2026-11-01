/**
 * Ergebnis von „Texte vergleichen“ als Unified Diff (Format von `diff -u`, lesbar für `patch` und
 * `git apply`): Kopfzeilen `---` und `+++`, Abschnitte `@@ -a,b +c,d @@` mit drei Zeilen Umfeld.
 * Zeilenende ist immer LF. Wurden Groß-/Kleinschreibung oder Leerzeichen übergangen, stehen
 * gleiche Zeilen in der Fassung des ursprünglichen Textes; ein Patch passt dann nur auf diesen.
 */

import type { Row } from './compare.ts';

const CONTEXT = 3;

function lineText(row: Row): string {
  return row.kind === 'equal' ? row.text : row.segments.map((s) => s.text).join('');
}

function range(count: number, start: number): string {
  return count === 1 ? String(start) : `${start},${count}`;
}

export function toUnifiedDiff(
  rows: readonly Row[],
  oldName = 'ursprung.txt',
  newName = 'neu.txt',
  context = CONTEXT,
): string {
  const spans: [number, number][] = [];
  rows.forEach((row, i) => {
    if (row.kind === 'equal') return;
    const from = Math.max(0, i - context);
    const to = Math.min(rows.length - 1, i + context);
    const last = spans[spans.length - 1];
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else spans.push([from, to]);
  });
  if (spans.length === 0) return '';

  const out = [`--- ${oldName}`, `+++ ${newName}`];
  for (const [from, to] of spans) {
    const part = rows.slice(from, to + 1);
    const oldRows = part.filter((r) => r.kind !== 'insert');
    const newRows = part.filter((r) => r.kind !== 'delete');
    // Ohne Zeile in einer Fassung zählt die Zeile davor (0 am Anfang), wie bei diff -u
    const before = rows.slice(0, from);
    const oldStart =
      oldRows.length > 0
        ? (oldRows[0] as { oldLine: number }).oldLine
        : before.reduce((n, r) => (r.kind !== 'insert' ? r.oldLine : n), 0);
    const newStart =
      newRows.length > 0
        ? (newRows[0] as { newLine: number }).newLine
        : before.reduce((n, r) => (r.kind !== 'delete' ? r.newLine : n), 0);
    out.push(
      `@@ -${range(oldRows.length, oldStart)} +${range(newRows.length, newStart)} @@`,
      ...part.map(
        (r) => `${r.kind === 'equal' ? ' ' : r.kind === 'delete' ? '-' : '+'}${lineText(r)}`,
      ),
    );
  }
  return `${out.join('\n')}\n`;
}
