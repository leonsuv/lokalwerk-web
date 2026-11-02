/**
 * Lesezeichen (Gliederung) einer PDF lesen und mit einer bearbeiteten Liste neu schreiben
 * (Werkzeug „PDF-Lesezeichen bearbeiten“). Ohne DOM, läuft im Worker.
 *
 * Quelle: ISO 32000-2, Abschnitt 12.3.3 (Gliederung: /Outlines, /First, /Last, /Next, /Prev,
 * /Parent, /Count, /Title, /Dest, /A), 12.3.2.3 (Ziele, benannte Ziele), 7.9.6 (Namensbäume).
 *
 * Gelesen wird die Gliederung in Lesereihenfolge. Ein Ziel gilt als gefunden, wenn es auf eine
 * Seite des Dokuments zeigt (direkt oder über einen benannten Eintrag in /Dests bzw. im
 * Namensbaum /Dests). Andere Aktionen als „GoTo“ (zum Beispiel Web-Adressen) und Ziele, die
 * nicht auflösbar sind, bleiben erhalten und werden mit page: null markiert.
 *
 * Geschrieben wird am Originaldokument: Seiten, Anhänge, Formulare und alles andere bleiben. Die
 * Einträge werden mit ihren Originalobjekten wiederverwendet, damit Stil und Ziel gleich bleiben.
 * Gelöschte Einträge werden aus der Datei entfernt, sonst bliebe ihr Titel darin lesbar.
 */

import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
  type PDFContext,
  type PDFDocument,
  type PDFObject,
} from 'pdf-lib';
import { type BookmarkEntry, BookmarkError, isValidOutline } from './bookmark-model.ts';
import { loadPdf, toPdfError } from './merge.ts';

export type { BookmarkEntry } from './bookmark-model.ts';

const MAX_ITEMS = 5000;
const MAX_DEPTH = 64;
const MAX_TREE_DEPTH = 32;

export interface BookmarkReadResult {
  /** Seitenzahl des Dokuments */
  pages: number;
  entries: BookmarkEntry[];
}

interface OriginalNode {
  ref: PDFRef;
  dict: PDFDict;
  entry: BookmarkEntry;
}

const key = (name: string) => PDFName.of(name);

function textOf(value: PDFObject | undefined): string {
  if (value instanceof PDFString || value instanceof PDFHexString) {
    try {
      return value.decodeText();
    } catch {
      return '';
    }
  }
  return '';
}

/** Schlüssel der Seitenreferenzen: Seiten sind über ihren Objektverweis eindeutig. */
function pageIndexByRef(doc: PDFDocument): Map<string, number> {
  const indexes = new Map<string, number>();
  doc.getPages().forEach((page, i) => indexes.set(page.ref.tag, i));
  return indexes;
}

function namedDestination(doc: PDFDocument, name: string): PDFObject | undefined {
  const catalog = doc.catalog;
  const dests = catalog.lookup(key('Dests'));
  if (dests instanceof PDFDict) {
    const value = dests.get(key(name));
    if (value !== undefined) return doc.context.lookup(value);
  }
  const names = catalog.lookup(key('Names'));
  if (names instanceof PDFDict) {
    return searchNameTree(doc, names.get(key('Dests')), name, 0);
  }
  return undefined;
}

/** Sucht einen Namen im Namensbaum (ISO 32000-2, 7.9.6), mit Tiefenbegrenzung. */
function searchNameTree(
  doc: PDFDocument,
  node: PDFObject | undefined,
  name: string,
  depth: number,
): PDFObject | undefined {
  const dict = node ? doc.context.lookup(node) : undefined;
  if (!(dict instanceof PDFDict) || depth > MAX_TREE_DEPTH) return undefined;
  const names = dict.lookup(key('Names'));
  if (names instanceof PDFArray) {
    for (let i = 0; i + 1 < names.size(); i += 2) {
      if (textOf(doc.context.lookup(names.get(i))) === name) {
        return doc.context.lookup(names.get(i + 1));
      }
    }
  }
  const kids = dict.lookup(key('Kids'));
  if (kids instanceof PDFArray) {
    for (let i = 0; i < kids.size(); i++) {
      const found = searchNameTree(doc, kids.get(i), name, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Seitenzahl (0-basiert) eines Ziels, sonst null. Ziel = Array oder Wörterbuch mit /D. */
function pageOfDestination(
  doc: PDFDocument,
  pages: Map<string, number>,
  value: PDFObject | undefined,
  depth = 0,
): number | null {
  if (depth > 2 || value === undefined) return null;
  const resolved = value instanceof PDFRef ? doc.context.lookup(value) : value;
  if (resolved instanceof PDFDict) {
    return pageOfDestination(doc, pages, resolved.get(key('D')), depth + 1);
  }
  if (
    resolved instanceof PDFName ||
    resolved instanceof PDFString ||
    resolved instanceof PDFHexString
  ) {
    const named = namedDestination(doc, resolved.decodeText());
    return pageOfDestination(doc, pages, named, depth + 1);
  }
  if (!(resolved instanceof PDFArray)) return null;
  const first = resolved.get(0);
  if (!(first instanceof PDFRef)) return null;
  return pages.get(first.tag) ?? null;
}

/** Seite eines Gliederungseintrags über /Dest oder eine GoTo-Aktion in /A. */
function pageOfItem(doc: PDFDocument, pages: Map<string, number>, dict: PDFDict): number | null {
  const dest = dict.get(key('Dest'));
  if (dest !== undefined) return pageOfDestination(doc, pages, dest);
  const action = dict.lookup(key('A'));
  if (!(action instanceof PDFDict)) return null;
  if (action.lookup(key('S')) !== key('GoTo')) return null;
  return pageOfDestination(doc, pages, action.get(key('D')));
}

/** Gliederung in Lesereihenfolge; Reihenfolge und Zählung sind für Lesen und Schreiben gleich. */
function readNodes(doc: PDFDocument): OriginalNode[] {
  const nodes: OriginalNode[] = [];
  const outlines = doc.catalog.lookup(key('Outlines'));
  if (!(outlines instanceof PDFDict)) return nodes;
  const pages = pageIndexByRef(doc);
  const seen = new Set<string>();

  const walk = (first: PDFObject | undefined, level: number): void => {
    if (level > MAX_DEPTH) throw new BookmarkError('too-deep');
    let current = first;
    while (current instanceof PDFRef) {
      if (seen.has(current.tag)) break;
      seen.add(current.tag);
      if (nodes.length >= MAX_ITEMS) throw new BookmarkError('too-large');
      const dict = doc.context.lookup(current);
      if (!(dict instanceof PDFDict)) break;
      nodes.push({
        ref: current,
        dict,
        entry: {
          title: textOf(dict.lookup(key('Title'))),
          level,
          page: pageOfItem(doc, pages, dict),
          origin: nodes.length,
        },
      });
      walk(dict.get(key('First')), level + 1);
      current = dict.get(key('Next'));
    }
  };
  walk(outlines.get(key('First')), 0);
  return nodes;
}

/** Lesezeichen einer PDF für die Bearbeitung. Wirft PdfError bei unlesbaren Dateien. */
export async function readBookmarks(bytes: Uint8Array): Promise<BookmarkReadResult> {
  const doc = await loadPdf(bytes);
  try {
    return {
      pages: doc.getPageCount(),
      entries: readNodes(doc).map((node) => node.entry),
    };
  } catch (error) {
    if (error instanceof BookmarkError) throw error;
    throw toPdfError(error);
  }
}

interface TreeNode {
  ref: PDFRef;
  dict: PDFDict;
  children: TreeNode[];
}

/** Verknüpft Geschwister und Kinder und setzt /Count (positiv = aufgeklappt). */
function link(ctx: PDFContext, siblings: TreeNode[], parent: PDFRef | null): void {
  siblings.forEach((node, i) => {
    const { dict } = node;
    const prev = siblings[i - 1];
    const next = siblings[i + 1];
    const first = node.children[0];
    const last = node.children.at(-1);
    if (parent) dict.set(key('Parent'), parent);
    if (prev) dict.set(key('Prev'), prev.ref);
    else dict.delete(key('Prev'));
    if (next) dict.set(key('Next'), next.ref);
    else dict.delete(key('Next'));
    if (first && last) {
      dict.set(key('First'), first.ref);
      dict.set(key('Last'), last.ref);
      dict.set(key('Count'), PDFNumber.of(countAll(node.children)));
      link(ctx, node.children, node.ref);
    } else {
      dict.delete(key('First'));
      dict.delete(key('Last'));
      dict.delete(key('Count'));
    }
  });
}

function countAll(nodes: TreeNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countAll(node.children), 0);
}

/**
 * Die Datei bekommt die Gliederung aus `entries`. Originaleinträge behalten ihr Objekt (Stil,
 * Ziel, Aktion); nur der Titel wird neu gesetzt, wenn er sich geändert hat. Neue Einträge zeigen
 * auf die Seite mit Anpassung „an die Seite“.
 */
export async function writeBookmarks(
  bytes: Uint8Array,
  entries: readonly BookmarkEntry[],
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  try {
    if (!isValidOutline(entries)) throw new BookmarkError('invalid-outline');
    const ctx = doc.context;
    const pages = doc.getPages();
    const originals = readNodes(doc);
    const kept = new Set<number>();
    for (const entry of entries) {
      if (entry.origin === null) continue;
      if (!originals[entry.origin] || kept.has(entry.origin)) {
        throw new BookmarkError('invalid-outline');
      }
      kept.add(entry.origin);
    }
    originals.forEach((node, index) => {
      if (!kept.has(index)) ctx.delete(node.ref);
    });

    const oldRoot = doc.catalog.get(key('Outlines'));
    const built: { level: number; node: TreeNode }[] = entries.map((entry) => {
      if (entry.origin !== null) {
        const original = originals[entry.origin];
        if (!original) throw new BookmarkError('invalid-outline');
        if (entry.title !== original.entry.title) {
          original.dict.set(key('Title'), PDFHexString.fromText(entry.title));
        }
        return {
          level: entry.level,
          node: { ref: original.ref, dict: original.dict, children: [] },
        };
      }
      const target = entry.page === null ? undefined : pages[entry.page];
      if (!target) throw new BookmarkError('page-out-of-range');
      const dict = PDFDict.withContext(ctx);
      dict.set(key('Title'), PDFHexString.fromText(entry.title));
      dict.set(key('Dest'), ctx.obj([target.ref, key('Fit')]));
      return { level: entry.level, node: { ref: ctx.register(dict), dict, children: [] } };
    });

    const roots: TreeNode[] = [];
    const stack: TreeNode[] = [];
    for (const { level, node } of built) {
      const parent = level === 0 ? undefined : stack[level - 1];
      if (level > 0 && !parent) throw new BookmarkError('invalid-outline');
      stack.length = level;
      const siblings = parent ? parent.children : roots;
      siblings.push(node);
      stack[level] = node;
    }

    if (oldRoot instanceof PDFRef) ctx.delete(oldRoot);
    if (roots.length === 0) {
      doc.catalog.delete(key('Outlines'));
    } else {
      const first = roots[0];
      const last = roots.at(-1);
      if (!first || !last) throw new BookmarkError('invalid-outline');
      const root = PDFDict.withContext(ctx);
      root.set(key('Type'), key('Outlines'));
      root.set(key('Count'), PDFNumber.of(countAll(roots)));
      root.set(key('First'), first.ref);
      root.set(key('Last'), last.ref);
      const rootRef = ctx.register(root);
      link(ctx, roots, rootRef);
      doc.catalog.set(key('Outlines'), rootRef);
    }
    return await doc.save();
  } catch (error) {
    if (error instanceof BookmarkError) throw error;
    throw toPdfError(error);
  }
}
