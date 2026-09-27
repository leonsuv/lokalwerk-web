/**
 * Seitenangaben wie „1-3, 5, 8-“ lesen und Aufteilungen berechnen (Werkzeug „PDF teilen“).
 * Seiten zählen hier ab 1, wie im PDF-Programm angezeigt. Reine Funktionen ohne pdf-lib.
 */

export interface PageRange {
  /** erste Seite, ab 1 */
  from: number;
  /** letzte Seite, einschließlich */
  to: number;
}

export type PageRangeError =
  | { code: 'empty' }
  | { code: 'syntax'; part: string }
  | { code: 'out-of-range'; part: string; pages: number }
  | { code: 'reversed'; part: string };

export type RangeResult = { ok: true; ranges: PageRange[] } | { ok: false; error: PageRangeError };

const PART = /^(\d+)?\s*(?:(-)\s*(\d+)?)?$/;

/**
 * „1-3, 5, 8-“: Bereiche durch Komma oder Semikolon getrennt, Bindestrich oder Gedankenstrich
 * für von–bis, „8-“ heißt bis zum Ende, „-3“ heißt ab Seite 1. Reihenfolge bleibt erhalten.
 */
export function parsePageRanges(input: string, pages: number): RangeResult {
  const parts = input
    .replace(/[‒-―−]/g, '-')
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length === 0) return { ok: false, error: { code: 'empty' } };

  const ranges: PageRange[] = [];
  for (const part of parts) {
    const match = PART.exec(part);
    if (!match || (match[1] === undefined && match[3] === undefined)) {
      return { ok: false, error: { code: 'syntax', part } };
    }
    const [, first, dash, last] = match;
    const from = first === undefined ? 1 : Number(first);
    const to = dash ? (last === undefined ? pages : Number(last)) : from;
    if (from < 1 || to < 1 || from > pages || to > pages) {
      return { ok: false, error: { code: 'out-of-range', part, pages } };
    }
    if (from > to) return { ok: false, error: { code: 'reversed', part } };
    ranges.push({ from, to });
  }
  return { ok: true, ranges };
}

/** Jede Seite als eigener Bereich */
export function singlePages(pages: number): PageRange[] {
  return Array.from({ length: pages }, (_, i) => ({ from: i + 1, to: i + 1 }));
}

/** Teile mit je `size` Seiten, der letzte Teil darf kürzer sein */
export function chunks(pages: number, size: number): PageRange[] {
  const step = Math.max(1, Math.floor(size));
  const ranges: PageRange[] = [];
  for (let from = 1; from <= pages; from += step) {
    ranges.push({ from, to: Math.min(pages, from + step - 1) });
  }
  return ranges;
}

/** Seitennummern (ab 0) eines Bereichs, für pdf-lib */
export function pageIndices(range: PageRange): number[] {
  return Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from - 1 + i);
}

/** „3“ oder „1-3“, für Dateinamen und Meldungen */
export function rangeLabel(range: PageRange): string {
  return range.from === range.to ? String(range.from) : `${range.from}-${range.to}`;
}

/** Seitennummern (ab 1) als möglichst wenige Bereiche, z. B. [5, 1, 2, 3] → 1-3, 5 */
export function rangesFromPages(pages: Iterable<number>): PageRange[] {
  const sorted = [...new Set(pages)]
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);
  const ranges: PageRange[] = [];
  for (const n of sorted) {
    const last = ranges.at(-1);
    if (last && last.to === n - 1) last.to = n;
    else ranges.push({ from: n, to: n });
  }
  return ranges;
}
